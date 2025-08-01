import {
  DESCRIPTION,
  ANNOTATIONS_TO_IGNORE_REGEX,
} from '@shell/config/labels-annotations';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { get, clone } from '@shell/utils/object';
import { formatSi } from '@shell/utils/units';
import { ucFirst } from '@shell/utils/string';
import { stateDisplay, colorForState } from '@shell/plugins/dashboard-store/resource-class';
import { _CLONE } from '@shell/config/query-params';
import { HCI } from '../types';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../config/harvester';
import HarvesterResource from './harvester';
import { CSI_SECRETS } from '@pkg/harvester/config/harvester-map';
import { UNIT_SUFFIX } from '../utils/unit';

const {
  CSI_PROVISIONER_SECRET_NAME,
  CSI_PROVISIONER_SECRET_NAMESPACE,
} = CSI_SECRETS;

function isReady() {
  function getStatusConditionOfType(type, defaultValue = []) {
    const conditions = Array.isArray(get(this, 'status.conditions')) ? this.status.conditions : defaultValue;

    return conditions.find( (cond) => cond.type === type);
  }

  const initialized = getStatusConditionOfType.call(this, 'Initialized');
  const imported = getStatusConditionOfType.call(this, 'Imported');
  const isCompleted = this.status?.progress === 100;

  if ([initialized?.status, imported?.status].includes('False')) {
    return false;
  } else {
    return isCompleted && true;
  }
}
export default class HciVmImage extends HarvesterResource {
  get availableActions() {
    let out = super._availableActions;
    const toFilter = ['goToEditYaml'];

    out = out.filter( (A) => !toFilter.includes(A.action));

    // show `Clone` only when imageSource is `download`
    if (this.imageSource !== 'download') {
      out = out.filter(({ action }) => action !== 'goToClone');
    }

    const schema = this.$getters['schemaFor'](HCI.VM);
    let canCreateVM = true;

    if ( schema && !schema?.collectionMethods.find((x) => ['post'].includes(x.toLowerCase())) ) {
      canCreateVM = false;
    }

    const customActions = this.isReady ? [
      {
        action:  'createFromImage',
        enabled: canCreateVM,
        icon:    'icon icon-circle-plus',
        label:   this.t('harvester.action.createVM'),
      },
      {
        action:  'encryptImage',
        enabled: this.volumeEncryptionFeatureEnabled && !this.isEncrypted,
        icon:    'icon icon-lock',
        label:   this.t('harvester.action.encryptImage'),
      },
      {
        action:  'decryptImage',
        enabled: this.volumeEncryptionFeatureEnabled && this.isEncrypted,
        icon:    'icon icon-unlock',
        label:   this.t('harvester.action.decryptImage'),
      },
      {
        action:  'imageDownload',
        enabled: this.links?.download,
        icon:    'icon icon-download',
        label:   this.t('asyncButton.download.action'),
      }
    ] : [];

    // imported image only allow download, download yaml and delete actions
    if (this.isImportedImage) {
      const custom = customActions.find((a) => a.action === 'imageDownload');
      const filtered = out.filter(({ action }) => ['download', 'promptRemove'].includes(action));

      return custom ? [custom, { divider: true }, ...filtered] : filtered;
    }

    // if the first item is a divider, remove it from the array
    const filteredOut = customActions.length > 0 ? out : (out[0]?.divider ? out.slice(1) : out);

    return [
      ...customActions,
      ...filteredOut
    ];
  }

  encryptImage() {
    const router = this.currentRouter();

    router.push({
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource-create`,
      params: { resource: HCI.IMAGE },
      query:  {
        image:           JSON.stringify({ metadata: { name: this.metadata.name, namespace: this.metadata.namespace } }),
        fromPage:        HCI.IMAGE,
        sourceType:      'clone',
        cryptoOperation: 'encrypt'
      }
    });
  }

  decryptImage() {
    const router = this.currentRouter();

    router.push({
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource-create`,
      params: { resource: HCI.IMAGE },
      query:  {
        image:           JSON.stringify({ metadata: { name: this.metadata.name, namespace: this.metadata.namespace } }),
        fromPage:        HCI.IMAGE,
        sourceType:      'clone',
        cryptoOperation: 'decrypt'
      }
    });
  }

  applyDefaults(resources = this, realMode) {
    if (realMode !== _CLONE) {
      this.metadata['labels'] = { [HCI_ANNOTATIONS.OS_TYPE]: '', [HCI_ANNOTATIONS.IMAGE_SUFFIX]: '' };
      this.metadata['annotations'] = { [HCI_ANNOTATIONS.STORAGE_CLASS]: '' };
    }
  }

  createFromImage() {
    const router = this.currentRouter();

    router.push({
      name:   `${ HARVESTER_PRODUCT }-c-cluster-resource-create`,
      params: { resource: HCI.VM },
      query:  { image: this.id, fromPage: HCI.IMAGE }
    });
  }

  cleanForNew() {
    this.$dispatch(`cleanForNew`, this);

    delete this.spec.displayName;
  }

  get nameDisplay() {
    return this.spec?.displayName;
  }

  get isOSImage() {
    return this?.metadata?.annotations?.[HCI_ANNOTATIONS.OS_UPGRADE_IMAGE] === 'True';
  }

  get isReady() {
    return isReady.call(this);
  }

  get stateDisplay() {
    const initialized = this.getStatusConditionOfType('Initialized');
    const imported = this.getStatusConditionOfType('Imported');

    if (imported?.status === 'Unknown') {
      if (this.spec.sourceType === 'restore') {
        return 'Restoring';
      }

      if (this.spec.sourceType === 'download') {
        return 'Downloading';
      }

      if (this.spec.sourceType === 'upload') {
        if (this.uploadError) {
          return 'Failed';
        }

        return 'Uploading';
      }

      return 'Exporting';
    }

    if (initialized?.message || imported?.message) {
      return 'Failed';
    }

    return stateDisplay(this.metadata.state.name);
  }

  get encryptionSecret() {
    const secretNS = this.spec.storageClassParameters[CSI_PROVISIONER_SECRET_NAMESPACE];
    const secretName = this.spec.storageClassParameters[CSI_PROVISIONER_SECRET_NAME];

    if (secretNS && secretName) {
      return `${ secretNS }/${ secretName }`;
    }

    return '';
  }

  get isEncrypted() {
    return this.spec.sourceType === 'clone' &&
    this.spec.securityParameters?.cryptoOperation === 'encrypt' &&
    !!this.spec.securityParameters?.sourceImageName &&
    !!this.spec.securityParameters?.sourceImageNamespace;
  }

  get isImportedImage() {
    return (this.metadata?.labels?.[HCI_ANNOTATIONS.IMPORTED_IMAGE]) === 'true';
  }

  get displayNameWithNamespace() {
    return `${ this.metadata.namespace }/${ this.spec.displayName }`;
  }

  get imageStorageClass() {
    return this?.metadata?.annotations?.[HCI_ANNOTATIONS.STORAGE_CLASS] || '';
  }

  get imageMessage() {
    if (this.uploadError) {
      return ucFirst(this.uploadError);
    }

    const conditions = this?.status?.conditions || [];
    const initialized = conditions.find( (cond) => cond.type === 'Initialized');
    const imported = conditions.find( (cond) => cond.type === 'Imported');
    const retryLimitExceeded = conditions.find( (cond) => cond.type === 'RetryLimitExceeded');
    const message = initialized?.message || imported?.message || retryLimitExceeded?.message;

    return ucFirst(message);
  }

  get stateBackground() {
    return colorForState(this.stateDisplay).replace('text-', 'bg-');
  }

  get imageSource() {
    return get(this, `spec.sourceType`) || 'download';
  }

  get progress() {
    return this?.status?.progress || 0;
  }

  get annotationsToIgnoreRegexes() {
    return [DESCRIPTION].concat(ANNOTATIONS_TO_IGNORE_REGEX);
  }

  get downSize() {
    const size = this.status?.size;

    if (!size) {
      return '-';
    }

    return formatSi(size, {
      increment:    1024,
      maxPrecision: 2,
      suffix:       UNIT_SUFFIX,
      firstSuffix:  UNIT_SUFFIX,
    });
  }

  get virtualSize() {
    const virtualSize = this.status?.virtualSize;

    if (!virtualSize) {
      return '-';
    }

    return formatSi(virtualSize, {
      increment:    1024,
      maxPrecision: 2,
      suffix:       UNIT_SUFFIX,
      firstSuffix:  UNIT_SUFFIX,
    });
  }

  getStatusConditionOfType(type, defaultValue = []) {
    const conditions = Array.isArray(get(this, 'status.conditions')) ? this.status.conditions : defaultValue;

    return conditions.find( (cond) => cond.type === type);
  }

  get stateObj() {
    const state = clone(this.metadata?.state);
    const initialized = this.getStatusConditionOfType('Initialized');
    const imported = this.getStatusConditionOfType('Imported');

    if ([initialized?.status, imported?.status].includes('False') || this.uploadError) {
      state.error = true;
    }

    return state;
  }

  get stateDescription() {
    return this.imageMessage;
  }

  get displayName() {
    return this.spec?.displayName;
  }

  get storageClassName() {
    return this.status?.storageClassName || '';
  }

  get uploadImage() {
    return async(file, opt = {}) => {
      const formData = new FormData();

      formData.append('chunk', file);

      try {
        this.$ctx.commit('harvester-common/uploadStart', this.metadata.name, { root: true });

        const result = await this.doAction('upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'File-Size':    file.size,
          },
          params: { size: file.size },
          signal: opt.signal,
        });

        return result;
      } catch (err) {
        this.$ctx.commit('harvester-common/uploadError', { name: this.name, message: err.message }, { root: true });
        this.$ctx.commit('harvester-common/uploadEnd', this.metadata.name, { root: true });
        throw err;
      } finally {
        this.$ctx.commit('harvester-common/uploadEnd', this.metadata.name, { root: true });
      }
    };
  }

  get uploadError() {
    return this.$rootGetters['harvester-common/uploadingImageError'](this.name);
  }

  get imageSuffix() {
    return this.metadata?.labels?.[HCI_ANNOTATIONS.IMAGE_SUFFIX];
  }

  get imageOSType() {
    return this.metadata?.labels?.[HCI_ANNOTATIONS.OS_TYPE];
  }

  get customValidationRules() {
    const out = [];

    if (this.imageSource === 'download') {
      const urlFormat = {
        nullable:   false,
        path:       'spec.url',
        validators: ['imageUrl'],
      };

      const urlRequired = {
        nullable:       false,
        path:           'spec.url',
        required:       true,
        translationKey: 'harvester.image.url'
      };

      out.push(urlFormat, urlRequired);
    }

    if (this.imageSource === 'upload') {
      const fileRequired = {
        nullable:   false,
        path:       'metadata.annotations',
        validators: ['fileRequired'],
      };

      out.push(fileRequired);
    }

    if (this.spec?.checksum?.length) {
      const checksumFormat = {
        path:       'spec.checksum',
        validators: ['hashSHA512'],
      };

      out.push(checksumFormat);
    }

    return [
      {
        nullable:       false,
        path:           'spec.displayName',
        required:       true,
        minLength:      1,
        maxLength:      63,
        translationKey: 'generic.name',
      },
      ...out
    ];
  }

  get volumeEncryptionFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('volumeEncryption');
  }

  get thirdPartyStorageFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('thirdPartyStorage');
  }

  imageDownload(resources = this) {
    // spec.backend is introduced in v1.5.0. If it's not set, it's an old image can be downloaded via link
    if (this.spec?.backend === 'cdi') {
      this.$dispatch('promptModal', {
        resources,
        component: 'HarvesterImageDownloader'
      });
    } else {
      this.downloadViaLink();
    }
  }

  downloadViaLink() {
    window.location.href = this.links.download;
  }
}
