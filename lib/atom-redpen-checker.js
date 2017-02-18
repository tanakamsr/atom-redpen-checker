'use babel';

import { CompositeDisposable } from 'atom';
import { BufferedProcess } from 'atom';
import { MessagePanelView, LineMessageView, PlainMessageView } from 'atom-message-panel';

export default {

  subscriptions: null,
  messagePanel: null,

  config: {
    redpenCLIPath: {
      title: 'RedPen CLI(Redpen\'s command line tool) path',
      description: 'Version 1.5 or higher is required.',
      type: 'string',
      default: '/usr/local/redpen/bin/redpen',
      order: 10
    },
    redpenConfigFile: {
      title: 'RedPen configuration XML file path',
      description: '',
      type: 'string',
      default: '',
      order: 20
    },
    javaHomePath: {
      title: 'JAVA_HOME path',
      description: 'Version 1.8.0_40 or higher is required.',
      type: 'string',
      default: '',
      order: 30
    },
    validateOnSave: {
      title: 'Validate on save',
      description: 'Perform verification every time you save the file.',
      type: 'boolean',
      default: 'false',
      order: 40
    }
  },

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'atom-redpen-checker:validate': () => this.validate()
    }));

    this.messagePanel = new MessagePanelView({
      title: '<span class="icon-bug"></span> Redpen Check Report.',
      rawTitle: true
    });

    const delegate = () => {
      if (atom.config.get('atom-redpen-checker.validateOnSave')) {
        this.validate();
      }
    };

    this.subscriptions.add(atom.workspace.observeTextEditors(editor =>
      editor.getBuffer().onDidSave(() => delegate())
    ));
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  validate() {
    var resultHandler = (result, errorLog) => {
      this.showResult(result, errorLog);
    }

    var handler = (accepts) => {
      if (accepts) {
        this.executeRedpen(resultHandler);
      }
    }
    this.versionCheck(handler);
  },

  versionCheck(callback) {
    const javaHomePath = atom.config.get('atom-redpen-checker.javaHomePath');
    if (javaHomePath === null || javaHomePath.trim().length === 0) {
      atom.notifications.addError('AtomRedpenChecker requires JAVA_HOME. See preferences.');
      callback(false);
      return;
    }
    // version check
    var versionOutput = '';
    const command = atom.config.get('atom-redpen-checker.redpenCLIPath');
    const args = ['-version'];
    const options = {env:{"JAVA_HOME": `${javaHomePath}`}};
    const stdout = (output) => versionOutput = output;
    const stderr = (output) => console.log(output);
    const exit = (code) => {
      if (code !== 0) {
        atom.notifications.addError('RedPen version check faild.');
        callback(false);
      } else {
        console.log(versionOutput);
        if (versionOutput != null &&  versionOutput.length > 0) {
          let versionArray = versionOutput.split(".");
          let editor = atom.workspace.getActiveTextEditor();
          const majorVersion = parseInt(versionArray[0], 10);
          const minorVersion = parseInt(versionArray[1], 10);
          let grammars = [
            'text.plain',
            'text.plain.null-grammar',
            'source.gfm',
            'text.md',
            'text.html.textile',
            'source.java-properties'
          ];
          if (majorVersion >=1 && minorVersion >=3) {
            grammars.push('source.asciidoc');
          }
          if (majorVersion >=1 && minorVersion >=4) {
            grammars.push('text.tex.latex');
          }
          const find = (item, grammars) => {
            for (let i = 0; i < grammars.length; i++) {
              if (grammars[i] === item) {
                return true;
              }
            }
            return false;
          };
          if (find(editor.getGrammar().scopeName, grammars)) {
            console.log('This document can be checked with Redpen.');
            callback(true);
          } else {
            console.log('This document can not be checked with Redpen.');
            callback(false);
          }
        }
        callback(false);
      }
    }
    const process = new BufferedProcess({command, args, options, stdout, stderr, exit});
  },

  executeRedpen(resultHandler) {
    const detectedInputFormat = () => {
      const grammar = atom.workspace.getActiveTextEditor().getGrammar();
      switch (grammar.scopeName) {
        case 'source.gfm':
        case 'text.md':
          return 'markdown';
        case 'text.html.textile':
          return 'wiki';
        case 'source.asciidoc':
          return 'asciidoc';
        case 'text.tex.latex':
          return 'latex';
        case 'source.java-properties':
          return 'properties';
        default:
          return 'plain';
      }
    };

    const sourceFilePath = atom.workspace.getActiveTextEditor().getPath();
    const command = atom.config.get('atom-redpen-checker.redpenCLIPath');
    let args = [
      '-f',
      detectedInputFormat(),
      '-r',
      'json',
      sourceFilePath
    ];
    const configFile = atom.config.get('atom-redpen-checker.redpenConfigFile');
    if (configFile !== null && configFile.trim().length !== 0) {
      args.splice(0, 0, '-c', configFile);
    }
    let errorLog = null;
    let result = null;
    const options = {env:{"JAVA_HOME": `${atom.config.get('atom-redpen-checker.javaHomePath')}`}};
    const stdout = (output) => result = JSON.parse(output);
    const stderr = (output) => errorLog = output;
    const exit = (code) => resultHandler(result, errorLog);
    const process = new BufferedProcess({command, args, options, stdout, stderr, exit});
  },

  showResult(result, errorLog) {
    if (result == null) {
      console.log(errorLog);
      atom.notifications.addError('RedPen check faild. show logs.');
    } else {
      console.log(result);
    }
    this.messagePanel.attach();
    this.messagePanel.clear();
    if (result[0].errors.length == 0) {
      console.log("Redpen check success.");
      this.messagePanel.add(new PlainMessageView({message: 'Success!!', className: 'text-success'}));
    } else {
      for (let error of result[0].errors) {
          let line = (error.startPosition === undefined ? error.lineNum : error.startPosition.lineNum);
          let offset = (error.startPosition === undefined ? error.sentenceStartColumnNum : error.startPosition.offset);
          this.messagePanel.add(new LineMessageView({
            message: error.message,
            preview: error.sentence,
            line: line,
            character: offset + 1,
            className: 'text-error'
          }));
      }
    }
  }

};
