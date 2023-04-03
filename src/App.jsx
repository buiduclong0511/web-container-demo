import { WebContainer } from "@webcontainer/api";
import { debounce } from "lodash";
import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { Terminal } from "xterm";

import "xterm/css/xterm.css";

const initFiles = {};

export const useDebouncedEffect = (effect, deps, delay) => {
    useEffect(() => {
        const handler = setTimeout(() => effect(), delay);

        return () => clearTimeout(handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...(deps || []), delay]);
};

function App() {
    const [files, setFiles] = useState([]);
    const [currentFile, setCurrentFile] = useState("");
    const [isBooting, setIsBooting] = useState(true);
    const [editorValue, setEditorValue] = useState("");
    const [webContainer, setWebContainer] = useState(null);

    const terminalEle = useRef(null);
    const terminal = useRef(null);
    const iframeRef = useRef(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const setContentFile = useCallback(
        debounce((currentFile, content) => {
            if (webContainer) {
                webContainer.fs.writeFile(currentFile, content);
            }
        }, 800),
        [webContainer]
    );

    /**
     * Load terminal
     */
    useEffect(() => {
        if (!isBooting && webContainer) {
            terminal.current = new Terminal({
                convertEol: true,
                rows: 15,
            });
            terminal.current.open(terminalEle.current);
        }
    }, [isBooting, webContainer]);

    /**
     * Boot container
     */
    useEffect(() => {
        WebContainer.boot()
            .then((res) => {
                setWebContainer(res);
            })
            .finally(() => setIsBooting(false));
    }, []);

    /**
     * Connect terminal with container
     */
    useEffect(() => {
        if (!isBooting && webContainer) {
            webContainer
                .mount(initFiles)
                .then(() => {
                    return webContainer.spawn("jsh");
                })
                .then((shellProcess) => {
                    shellProcess.output.pipeTo(
                        new WritableStream({
                            write(data) {
                                terminal.current.write(data);
                            },
                        })
                    );
                    const input = shellProcess.input.getWriter();
                    terminal.current.onData((data) => {
                        input.write(data);
                    });
                    return shellProcess;
                });
        }
    }, [isBooting, webContainer]);

    /**
     * Read content of current file
     */
    useEffect(() => {
        if (webContainer && currentFile && files.length) {
            webContainer.fs
                .readFile(currentFile, "utf-8")
                .then((fileContent) => {
                    setEditorValue(fileContent);
                });
        }
    }, [currentFile, files.length, webContainer]);

    /**
     * Reload server
     */
    useEffect(() => {
        if (!isBooting && webContainer) {
            webContainer.on("server-ready", (port, url) => {
                iframeRef.current.src = url;
            });
        }
    }, [isBooting, webContainer]);

    /**
     * Pooling files list
     */
    useEffect(() => {
        const timer = setInterval(() => {
            if (webContainer) {
                webContainer.fs.readdir(".").then((files) => {
                    setFiles(files);
                    setCurrentFile((prev) => {
                        return prev || files[0];
                    });
                });
            }
        }, 800);

        return () => clearInterval(timer);
    }, [webContainer]);

    return (
        <Container>
            <div className="main">
                <div className="editor">
                    <div className="files">
                        {files.map((file) => (
                            <div
                                className={`file ${
                                    file === currentFile ? "active" : ""
                                }`}
                                key={file}
                                onClick={() => setCurrentFile(file)}
                            >
                                {file}
                            </div>
                        ))}
                    </div>
                    <textarea
                        id="input"
                        value={editorValue}
                        onChange={(e) => {
                            setEditorValue(e.target.value);
                            setContentFile(currentFile, e.target.value);
                        }}
                    ></textarea>
                </div>
                <div className="browser">
                    <iframe ref={iframeRef} title="browser"></iframe>
                </div>
            </div>
            <div className="terminal">
                <div ref={terminalEle} id="terminal"></div>
            </div>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100vh;

    .main {
        display: flex;
        flex: 3;
    }

    .editor {
        flex: 1;
        display: flex;
        flex-direction: column;

        .files {
            display: flex;

            .file {
                background-color: #272626;
                padding: 8px 16px;
                cursor: pointer;
            }

            .file.active {
                background-color: rgb(30 49 79);
            }
        }

        #input {
            background-color: #000;
            width: 100%;
            flex: 1;
            resize: none;
            color: #fff;
            border: none;
            outline: none;
            padding: 8px;
        }
    }

    .browser {
        flex: 1;

        iframe {
            height: 100%;
            width: 100%;
            border: none;
            background-color: #fff;
        }
    }

    .terminal {
        background-color: #000;
        padding: 8px;
    }
`;

export default App;
