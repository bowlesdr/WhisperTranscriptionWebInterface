import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import DOMPurify from 'dompurify';
import '../app.css';

function mergeArrowRanges(input: string): string {
  const parts = input.split('→').map((part) => part.trim());
  if (parts.length < 2) {
    throw new Error("Input string must contain at least one '→' character.");
  }
  return `${parts[0]}→${parts[parts.length - 1]}`;
}

const copyTableToClipboard = (tableId: string) => {
  const table = document.getElementById(tableId) as HTMLTableElement | null;
  if (!table) {
    console.error(`Table with ID '${tableId}' not found.`);
    return;
  }

  const rows = Array.from(table.rows);
  const tableText = rows
    .map((row) => {
      const cells = Array.from(row.cells);
      return cells.map((cell) => cell.textContent?.trim() || '').join('\t');
    })
    .join('\n');

  navigator.clipboard.writeText(tableText).then(
    () => console.log('Table copied to clipboard!'),
    (err) => console.error('Failed to copy table: ', err)
  );
};

const FileUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Please select a file to upload.');
  const [progBarVisible, setProgBarVisible] = useState(false);
  const showProgressBar = () => {
    setProgBarVisible(true);
  };
  const hideProgressBar = () => {
    setProgBarVisible(false);
  };
  const [language, setLanguage] = useState('English'); // Default language
  const handleLanguageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLanguage(event.target.value);
  };
  const [transcriptText, setTranscriptText] = useState(``);

  useEffect(() => {
    let isDragging = false;
    let selectedRows: HTMLTableRowElement[] = [];

    const attachListeners = () => {
      const table = document.getElementById('transcTable');
      if (!table) {
        console.error(
          "Table not found. Ensure there is a table with ID 'transcTable'."
        );
        return;
      }

      const rows = Array.from(
        table.querySelectorAll('tbody tr')
      ) as HTMLTableRowElement[];

      const handleMouseDown = (event: MouseEvent) => {
        const row = (event.target as HTMLElement).closest(
          'tr'
        ) as HTMLTableRowElement | null;
        if (row && rows.includes(row)) {
          isDragging = true;
          selectedRows = [row];
          row.classList.add('selected');
        }
      };

      const handleMouseOver = (event: MouseEvent) => {
        if (!isDragging) return;

        const row = (event.target as HTMLElement).closest(
          'tr'
        ) as HTMLTableRowElement | null;
        if (row && rows.includes(row) && !selectedRows.includes(row)) {
          selectedRows.push(row);
          row.classList.add('selected');
        }
      };

      const handleMouseUp = () => {
        if (isDragging && selectedRows.length > 1) {
          combineRows();
        }
        isDragging = false;
        selectedRows.forEach((row) => row.classList.remove('selected'));
        selectedRows = [];
      };

      const combineRows = () => {
        const columnCount = selectedRows[0].cells.length;
        const combinedData: string[] = Array(columnCount).fill('');

        let lastRowID = -999;
        selectedRows.forEach((row) => {
          Array.from(row.cells).forEach((cell, index) => {
            if (parseInt(row.id) < lastRowID) {
              combinedData[index] = `${cell.textContent || ''} ${
                combinedData[index]
              }`;
            } else {
              combinedData[index] += `${cell.textContent || ''}`;
            }
          });
          lastRowID = parseInt(row.id);
        });

        combinedData.forEach((data, index) => {
          if (index == 0) {
            selectedRows[0].cells[index].textContent = mergeArrowRanges(
              data.trim()
            );
          } else {
            selectedRows[0].cells[index].textContent = data.trim();
          }
        });

        selectedRows.slice(1).forEach((row) => row.remove());
        copyTableToClipboard('transcTable');
      };

      table.addEventListener('mousedown', handleMouseDown);
      table.addEventListener('mouseover', handleMouseOver);
      document.addEventListener('mouseup', handleMouseUp);

      // Cleanup listeners to avoid duplicates
      return () => {
        table.removeEventListener('mousedown', handleMouseDown);
        table.removeEventListener('mouseover', handleMouseOver);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    };

    // Attach listeners after every table update
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'childList' &&
          (mutation.target as HTMLElement).id === 'transcTableDiv'
        ) {
          attachListeners();
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const socket = io('http://192.168.1.76:3000', {
      transports: ['websocket'],
    });

    socket.on('transcriptionComplete', (tableHTML) => {
      /* The table HTML is generated with controlled code on the server
        Whisper transcribed text. It is also sanitized here using
        DOMPurify.sanitize() */
      const sanitizedHtml = DOMPurify.sanitize(tableHTML);
      setMessage('Transcript complete; see text below.');
      setTranscriptText(sanitizedHtml);
    });

    socket.on('uploadProgress', (data) => {
      setProgress(data.progress);
      if (data.progress == '100') {
        setMessage(
          'File upload complete. Starting transcription using <a href="https://openai.com/index/whisper/" target="_blank">Whisper</a>. Please wait.\n' +
            'This can sometimes take almost as long as it takes to play the recording.\n' +
            '<div class="spinner"></div>'
        );
        hideProgressBar();
      }
    });

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
    });

    return () => {
      socket.disconnect();
      observer.disconnect();
    };
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);

    try {
      showProgressBar();
      setMessage('File is uploading. Please wait.');
      const response = await axios.post(
        'http://192.168.1.76:3000/upload',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      setMessage(response.data.message);
    } catch (error: any) {
      setMessage('File upload failed');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h3>Select a language for the transcription:</h3>
        <label>
          <input
            type="radio"
            value="English"
            checked={language === 'English'}
            onChange={handleLanguageChange}
          />
          English
        </label>
        <label>
          <input
            type="radio"
            value="French"
            checked={language === 'French'}
            onChange={handleLanguageChange}
          />
          French
        </label>
      </div>
      <div>
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload}>Upload & Transcribe My File</button>
      </div>
      {progBarVisible && (
        <div className="progressBarContainer">
          <div
            className="progressBar"
            style={{
              height: '100%',
              backgroundColor: '#4caf50',
              width: `${progress}%`,
            }}
          ></div>
        </div>
      )}
      {message.split('\n').map((line, index) => (
        <div
          style={{ marginTop: '10px' }}
          key={index}
          dangerouslySetInnerHTML={{ __html: line }}
        />
      ))}
      <div
        id="transcTableDiv"
        dangerouslySetInnerHTML={{ __html: transcriptText }}
      />
    </div>
  );
};

export default FileUpload;
