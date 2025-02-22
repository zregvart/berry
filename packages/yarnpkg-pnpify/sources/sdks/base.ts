import {PortablePath}                           from '@yarnpkg/fslib';
import {PnpApi}                                 from '@yarnpkg/pnp';

import {Wrapper, GenerateBaseWrapper, BaseSdks} from '../generateSdk';

export const generateEslintBaseWrapper: GenerateBaseWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`eslint` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`bin/eslint.js` as PortablePath);
  await wrapper.writeFile(`lib/api.js` as PortablePath);

  return wrapper;
};

export const generatePrettierBaseWrapper: GenerateBaseWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`prettier` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`index.js` as PortablePath, {usePnpify: true});

  return wrapper;
};

export const generateTypescriptLanguageServerBaseWrapper: GenerateBaseWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`typescript-language-server` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`lib/cli.js` as PortablePath);

  return wrapper;
};

export const generateTypescriptBaseWrapper: GenerateBaseWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const tsServerMonkeyPatch = `
    tsserver => {
      const {isAbsolute} = require(\`path\`);
      const {resolveVirtual} = require(\`pnpapi\`);

      // VSCode sends the zip paths to TS using the "zip://" prefix, that TS
      // doesn't understand. This layer makes sure to remove the protocol
      // before forwarding it to TS, and to add it back on all returned paths.

      function toEditorPath(str) {
        // We add the \`zip:\` prefix to both \`.zip/\` paths and virtual paths
        if (isAbsolute(str) && !str.match(/^\\^zip:/) && (str.match(/\\.zip\\//) || str.match(/\\$\\$virtual\\//))) {
          // We also take the opportunity to turn virtual paths into physical ones;
          // this makes is much easier to work with workspaces that list peer
          // dependencies, since otherwise Ctrl+Click would bring us to the virtual
          // file instances instead of the real ones.
          const physicalFilePath = (resolveVirtual(str) || str)
            .replace(/\\\\/g, \`/\`)
            .replace(/^\\/?/, \`/\`);

          // Absolute VSCode \`Uri.fsPath\`s need to start with a slash.
          // VSCode only adds it automatically for supported schemes,
          // so we have to do it manually for the \`zip\` scheme.
          // The path needs to start with a caret otherwise VSCode doesn't handle the protocol
          // https://github.com/microsoft/vscode/issues/105014#issuecomment-686760910
          return \`\${isVSCode ? '^' : ''}zip:\${physicalFilePath}\`;
        } else {
          return str;
        }
      }

      function fromEditorPath(str) {
        return process.platform === \`win32\`
          ? str.replace(/^\\^?zip:\\//, \`\`)
          : str.replace(/^\\^?zip:/, \`\`);
      }

      // And here is the point where we hijack the VSCode <-> TS communications
      // by adding ourselves in the middle. We locate everything that looks
      // like an absolute path of ours and normalize it.

      const Session = tsserver.server.Session;
      const {onMessage: originalOnMessage, send: originalSend} = Session.prototype;
      let isVSCode = false;

      return Object.assign(Session.prototype, {
        onMessage(/** @type {string} */ message) {
          const parsedMessage = JSON.parse(message)

          if (
            parsedMessage != null &&
            typeof parsedMessage === \`object\` &&
            parsedMessage.arguments &&
            parsedMessage.arguments.hostInfo === \`vscode\`
          ) {
            isVSCode = true;
          }

          return originalOnMessage.call(this, JSON.stringify(parsedMessage, (key, value) => {
            return typeof value === \`string\` ? fromEditorPath(value) : value;
          }));
        },

        send(/** @type {any} */ msg) {
          return originalSend.call(this, JSON.parse(JSON.stringify(msg, (key, value) => {
            return typeof value === \`string\` ? toEditorPath(value) : value;
          })));
        }
      });
    };
  `;

  const wrapper = new Wrapper(`typescript` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`bin/tsc` as PortablePath);
  await wrapper.writeBinary(`bin/tsserver` as PortablePath);

  await wrapper.writeFile(`lib/tsc.js` as PortablePath);
  await wrapper.writeFile(`lib/tsserver.js` as PortablePath, {wrapModule: tsServerMonkeyPatch});
  await wrapper.writeFile(`lib/typescript.js` as PortablePath);

  return wrapper;
};

export const generateStylelintBaseWrapper: GenerateBaseWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`stylelint` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`bin/stylelint.js` as PortablePath);
  await wrapper.writeFile(`lib/index.js` as PortablePath);

  return wrapper;
};

export const generateSvelteLanguageServerBaseWrapper: GenerateBaseWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`svelte-language-server` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`bin/server.js` as PortablePath);

  return wrapper;
};

export const generateFlowBinBaseWrapper: GenerateBaseWrapper = async (pnpApi: PnpApi, target: PortablePath) => {
  const wrapper = new Wrapper(`flow-bin` as PortablePath, {pnpApi, target});

  await wrapper.writeManifest();

  await wrapper.writeBinary(`cli.js` as PortablePath);

  return wrapper;
};

export const BASE_SDKS: BaseSdks = [
  [`eslint`, generateEslintBaseWrapper],
  [`prettier`, generatePrettierBaseWrapper],
  [`typescript-language-server`, generateTypescriptLanguageServerBaseWrapper],
  [`typescript`, generateTypescriptBaseWrapper],
  [`stylelint`, generateStylelintBaseWrapper],
  [`svelte-language-server`, generateSvelteLanguageServerBaseWrapper],
  [`flow-bin`, generateFlowBinBaseWrapper],
];
