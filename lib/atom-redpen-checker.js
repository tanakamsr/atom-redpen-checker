'use babel';

import {
    CompositeDisposable,
    BufferedProcess
} from 'atom';
import {
    MessagePanelView,
    LineMessageView,
    PlainMessageView
} from 'atom-message-panel';

export default {

    subscriptions: null,
    messagePanel: null,
    messagePanel2: null,

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
        },
        restrictionExtension: {
            title: 'Execution restriction by extension',
            description: 'Perform validation on save only when set extension. ' +
                'Multiple designation possible with comma separated.(example: adoc,md,txt)',
            type: 'array',
            default: [],
            order: 50,
            items: {
                type: 'string'
            }
        }
    },

    activate(state) {
        // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
        this.subscriptions = new CompositeDisposable();

        // Register command that toggles this view
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'atom-redpen-checker:validate': () => this.validate()
        }));

        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'atom-redpen-checker:selectedTextValidate': () => this.selectedTextValidate()
        }));

        this.messagePanel = new MessagePanelView({
            title: '<span class="icon-bug"></span> Redpen Check Report.',
            rawTitle: true
        });

        this.messagePanel2 = new MessagePanelView({
            title: '<span class="icon-bug"></span> Redpen Check Report [Selected Text].',
            rawTitle: true
        });


        const delegate = () => {
            if (atom.config.get('atom-redpen-checker.validateOnSave')) {
                const extensions = atom.config.get('atom-redpen-checker.restrictionExtension');
                const pathArray = atom.workspace.getActiveTextEditor().getPath().split(".");
                const sourceExtension = pathArray[pathArray.length - 1].toLowerCase();
                if (extensions.length == 0 || extensions.some(x => x.toLowerCase() === sourceExtension)) {
                    this.validate();
                }
            }
        };

        this.subscriptions.add(atom.workspace.observeTextEditors(editor =>
            editor.getBuffer().onDidSave(() => delegate())
        ));
    },

    deactivate() {
        this.subscriptions.dispose();
    },

    selectedTextValidate() {
        var fs = require('fs');
        const textEditor = atom.workspace.getActiveTextEditor();
        const selectedText = textEditor.getSelectedText();
        if (selectedText.length !== 0) {
            const tmpPath = `${textEditor.getDirectoryPath()}/redpen-${Date.now()}.tmp`;

            var resultHandler = (sourceFileName, result, errorLog) => {
                this.showResult2(sourceFileName, result, errorLog, textEditor.getSelectedBufferRange().start.row);
                fs.unlinkSync(tmpPath);
            }

            var handler = (accepts) => {
                if (accepts) {
                    fs.writeFileSync(tmpPath, selectedText);
                    this.executeRedpen(resultHandler, tmpPath);
                }
            }
            this.versionCheck(handler);
        }
    },

    validate() {
        var resultHandler = (sourceFileName, result, errorLog) => {
            this.showResult(sourceFileName, result, errorLog);
        }

        var handler = (accepts) => {
            if (accepts) {
                this.executeRedpen(resultHandler, null);
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
        const options = {
            env: {
                "JAVA_HOME": `${javaHomePath}`
            }
        };
        const stdout = (output) => versionOutput = output;
        const stderr = (output) => console.log(output);
        const exit = (code) => {
            if (code !== 0) {
                atom.notifications.addError('RedPen version check faild.');
                callback(false);
            } else {
                console.log(versionOutput);
                if (versionOutput != null && versionOutput.length > 0) {
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
                    if (majorVersion >= 1 && minorVersion >= 3) {
                        grammars.push('source.asciidoc');
                    }
                    if (majorVersion >= 1 && minorVersion >= 4) {
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
                    if (editor.getGrammar() !== undefined && find(editor.getGrammar().scopeName, grammars)) {
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
        const process = new BufferedProcess({
            command,
            args,
            options,
            stdout,
            stderr,
            exit
        });
    },

    executeRedpen(resultHandler, tmpFile) {
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

        var sourceFilePath = atom.workspace.getActiveTextEditor().getPath();
        if (tmpFile !== null) {
            sourceFilePath = tmpFile;
        }
        const sourceFileName = atom.workspace.getActiveTextEditor().getTitle();
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
        const options = {
            env: {
                "JAVA_HOME": `${atom.config.get('atom-redpen-checker.javaHomePath')}`
            }
        };
        const stdout = (output) => result = JSON.parse(output);
        const stderr = (output) => errorLog = output;
        const exit = (code) => resultHandler(sourceFileName, result, errorLog);
        const process = new BufferedProcess({
            command,
            args,
            options,
            stdout,
            stderr,
            exit
        });
    },

    showResult(sourceFileName, result, errorLog) {
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
            this.messagePanel.add(new PlainMessageView({
                message: `No error in ${sourceFileName}`,
                className: 'text-success'
            }));
            this.messagePanel.add(new PlainMessageView({
                message: "Passed Redpen check!!",
                className: 'text-info'
            }));
        } else {
            this.messagePanel.add(new PlainMessageView({
                message: `${result[0].errors.length} errors in ${sourceFileName}`,
                className: 'text-error'
            }));
            result[0].errors.forEach(error => {
                let line = (error.startPosition === undefined ? error.lineNum : error.startPosition.lineNum);
                let offset = (error.startPosition === undefined ? error.sentenceStartColumnNum : error.startPosition.offset);
                this.messagePanel.add(new LineMessageView({
                    message: error.message,
                    preview: error.sentence,
                    line: line,
                    character: offset + 1,
                    className: 'text-error'
                }));
            });
        }
    },

    showResult2(sourceFileName, result, errorLog, startLine) {
        if (result == null) {
            console.log(errorLog);
            atom.notifications.addError('RedPen check faild. show logs.');
        } else {
            console.log(result);
        }
        this.messagePanel2.attach();
        this.messagePanel2.clear();

        if (result[0].errors.length == 0) {
            console.log("Redpen check success.");
            this.messagePanel2.add(new PlainMessageView({
                message: `No error on selected text in ${sourceFileName}`,
                className: 'text-success'
            }));
            this.messagePanel2.add(new PlainMessageView({
                message: "Passed Redpen check!!",
                className: 'text-info'
            }));
        } else {
            this.messagePanel2.add(new PlainMessageView({
                message: `${result[0].errors.length} errors in ${sourceFileName}`,
                className: 'text-error'
            }));
            result[0].errors.forEach(error => {
                let line = (error.startPosition === undefined ? error.lineNum : error.startPosition.lineNum) + startLine;
                let offset = (error.startPosition === undefined ? error.sentenceStartColumnNum : error.startPosition.offset);
                this.messagePanel2.add(new LineMessageView({
                    message: error.message,
                    preview: error.sentence,
                    line: line,
                    character: offset + 1,
                    className: 'text-error'
                }));
            });
        }
    }


};
