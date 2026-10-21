import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  IEditorExtensionRegistry,
  EditorExtensionRegistry
} from '@jupyterlab/codemirror';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import {
  snippetCompletion,
  autocompletion,
  completeFromList
} from '@codemirror/autocomplete';
import type { Completion } from '@codemirror/autocomplete';
import Ajv from 'ajv';

type SnippetConfigurationItem = Completion & { body: string };
type SnippetConfiguration = {
  snippets: SnippetConfigurationItem[];
};

const SNIPPET_EXTENSION_SCHEMA = {
  properties: {
    snippets: {
      type: 'array',
      title: 'Codemirror snippets',
      description:
        'Snippets of the form accepted by Codemirrors snippetCompletion',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'class',
              'constant',
              'enum',
              'function',
              'interface',
              'keyword',
              'method',
              'namespace',
              'property',
              'text',
              'type',
              'variable'
            ]
          },

          body: { type: 'string' },
          label: { type: 'string' }
        },
        required: ['type', 'body', 'label']
      }
    }
  },
  additionalProperties: false,
  type: 'object'
};

function validateSnippetConfig(config: SnippetConfiguration) {
  const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

  const validate = ajv.compile(SNIPPET_EXTENSION_SCHEMA);

  if (validate(config)) {
    return config;
  } else {
    console.error('The editor snippet config was not valid!');
    for (const error of validate.errors!) {
      console.error(`${error.instancePath}: ${error.message}`);
    }
    return {
      snippets: []
    };
  }
}

const SNIPPETS_PLUGIN_ID = 'gennaker-tools:snippets';
export const snippetsPlugin: JupyterFrontEndPlugin<void> = {
  id: SNIPPETS_PLUGIN_ID,
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [IEditorExtensionRegistry, ISettingRegistry],
  optional: [],
  activate: (app: JupyterFrontEnd, registry: IEditorExtensionRegistry, settings: ISettingRegistry,) => {


  // Setting for writable folder
  // This should be a path like /foo/nar, or empty string "" meaning not-set


  /**
    * Implement the handler for settings changes
    *
    * @param setting Extension settings
    */
  const loadSetting = async (setting: ISettingRegistry.ISettings) => {
    // Read the settings and convert to the correct type
    const snippets = setting.get('snippets').composite as any as SnippetConfigurationItem[];
    console.log("snippets loaded!", snippets)
    const {composite} = await settings.get("@jupyterlab/notebook-extension:tracker", "codeCellConfig");

    if (composite != undefined) {
      ((composite as any)["gennaker-tools:snippets"] as any)["snippets"] = snippets as any;
      await settings.set("@jupyterlab/notebook-extension:tracker", "codeCellConfig", composite);
    }
  };

  // Wait for the application to be restored and
  // for the settings for this plugin to be loaded
  Promise.all([app.restored, settings.load(SNIPPETS_PLUGIN_ID)])
    .then(([, setting]) => {
      // Read the settings
      loadSetting(setting);

      // Listen for your plugin setting changes using Signal
      setting.changed.connect(loadSetting);
    })
    .catch(reason => {
      console.error(
        `Something went wrong when reading the settings.\n${reason}`
      );
    });


    console.log('JupyterLab plugin gennaker-tools:snippets is activated!');
    registry.addExtension(
      Object.freeze({
        name: 'gennaker-tools:snippets',
        factory: () =>
          EditorExtensionRegistry.createConfigurableExtension(
            (config: SnippetConfiguration) => {
              config = validateSnippetConfig(config);
              return autocompletion({
                override: [
                  completeFromList(
                    config.snippets.map(snippet => {
                      const { body, ...rest } = snippet;
                      return snippetCompletion(body, rest);
                    })
                  )
                ]
              });
            }
          ),
        default: { snippets: [] },
        schema: SNIPPET_EXTENSION_SCHEMA
      })
    );
  }
};
