import React from 'react';
import styles from './Home.css';
const { desktopCapturer } = require('electron');
const fs = require('fs');
const gifshot = require('gifshot');
const gify = require('gify');
var mediaRecorder;

const getSources = async () => {
  return await desktopCapturer.getSources({ types: ['window', 'screen'] });
};

const startCapture = (sourceId: string, sourceName: string) => {
  getSources().then(async (sources) => {
    for (const source of sources) {
      if (source.id === sourceId) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              // @ts-ignore
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id,
              },
            },
          });
          handleStream(stream, sourceName);
        } catch (e) {
          handleError(e);
        }
        return;
      }
    }
  });
};

function handleStream(stream: MediaStream, sourceName: string) {
  var options = { mimeType: 'video/webm; codecs=vp9' };
  mediaRecorder = new MediaRecorder(stream, options);
  var recordedChunks = [];

  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start();

  function handleDataAvailable(event) {
    const tracks = stream.getTracks();

    tracks.forEach(function (track) {
      track.stop();
    });
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
      download(sourceName);
    } else {
      // ...
    }
  }

  const getVideoDimension = async (
    blob
  ): Promise<{ videoWidth: number; videoHeight: number }> => {
    return new Promise((resolve, reject) => {
      var reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.addEventListener(
        'load',
        function () {
          var videoTag = document.createElement('video');
          videoTag.src = reader.result;
          videoTag.addEventListener('loadedmetadata', function (e) {
            resolve({
              videoWidth: videoTag.videoWidth,
              videoHeight: videoTag.videoHeight,
            });
          });
        },
        false
      );
    });
  };

  function download(sourceName: string) {
    var blob = new Blob(recordedChunks, {
      type: 'video/webm',
    });
    async function saveFile() {
      const buffer = Buffer.from(await blob.arrayBuffer());
      let downloadPath =
        require('electron').remote.app.getPath('downloads') +
        '/' +
        sourceName.replace(/\s/g, '_');
      let downloadPathVideo = downloadPath + '.webm';
      let downloadPathGIF = downloadPath + '.gif';
      const { videoWidth, videoHeight } = await getVideoDimension(blob);
      const imageDownscale = 0.7;
      fs.writeFile(downloadPathVideo, buffer, (err) => {
        gify(
          downloadPathVideo,
          downloadPathGIF,
          {
            height: videoHeight * imageDownscale,
            width: videoWidth * imageDownscale,
          },
          function (error) {
            if (error) {
              console.log(err);
              gifshot.createGIF(
                {
                  video: downloadPathVideo,
                  gifHeight: videoHeight * imageDownscale,
                  gifWidth: videoWidth * imageDownscale,
                  numFrames: 150,
                },
                (obj) => {
                  let gifData = obj.image.replace(
                    /^data:image\/gif;base64,/,
                    ''
                  );
                  fs.writeFile(downloadPathGIF, gifData, 'base64', function (
                    err
                  ) {
                    console.log(err);
                  });
                }
              );
            }
          }
        );
      });
    }
    saveFile();
  }
}

function handleError(e) {
  console.log(e);
}

function stopCapture() {
  if (mediaRecorder) {
    mediaRecorder.stop();
  }
}

export default function Home(): JSX.Element {
  const [windowList, setWindowList] = React.useState<
    Electron.DesktopCapturerSource[]
  >([]);
  const [selectedWindowId, setSelectedWindowId] = React.useState<string>(null);
  const [simulatorOnly, toggleSimulator] = React.useState(true);
  const [isRecordingWindow, setIsRecordingWindow] = React.useState(false);
  const refreshData = async () => {
    const windowList = await getSources();
    setWindowList(windowList);
  };

  React.useEffect(() => {
    refreshData();
  }, []);

  React.useEffect(() => {
    if (isRecordingWindow) {
      const sourceName =
        windowList.find((window) => window.id === selectedWindowId)?.name ||
        'recorded window';
      startCapture(selectedWindowId, sourceName);
    } else {
      stopCapture();
    }
  }, [isRecordingWindow]);
  return (
    <div className={styles.container} data-tid="container">
      <label htmlFor="pet-select">Select a window to record:</label>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <select
          name="pets"
          id="pet-select"
          className={styles.windowSelectBox}
          onChange={(event) => setSelectedWindowId(event.target.value)}
        >
          {windowList.map((window) => {
            return (
              <option key={window.id} value={window.id}>
                {window.name}
              </option>
            );
          })}
        </select>
        <div style={{ marginLeft: 16 }}>
          <button className="btn btn-lg" onClick={() => refreshData()}>
            <i className="icon icon-refresh"></i> Refresh
          </button>
        </div>
      </div>

      <div style={{ alignSelf: 'center', margin: 32 }}>
        <button
          className={`btn ${
            isRecordingWindow ? 'btn-error' : 'btn-success'
          } btn-lg`}
          onClick={() =>
            setIsRecordingWindow((isRecordingWindow) => !isRecordingWindow)
          }
        >
          {isRecordingWindow ? (
            <i className="icon icon-stop"></i>
          ) : (
            <i className="icon icon-check"></i>
          )}
          {isRecordingWindow ? ' Stop Recording' : ' Start Recording'}
        </button>
      </div>
      <div style={{ alignSelf: 'center' }}>
        The video and the GIF will be automatically generated in your Download
        folder
      </div>
      {/*
      <div className="form-group">
        <label className="form-checkbox">
          <input type="checkbox" />
          <i className="form-icon"></i> Display simulators only
        </label>
        <label className="form-checkbox">
          <input type="checkbox" />
          <i className="form-icon"></i> 10 Mb max (for Github)
        </label>
        <label className="form-checkbox">
          <input type="checkbox" />
          <i className="form-icon"></i> Generate a GIF
        </label>
        <label className="form-checkbox">
          <input type="checkbox" />
          <i className="form-icon"></i> Copy GIF to clipboard
        </label>
          </div>*/}
    </div>
  );
}
