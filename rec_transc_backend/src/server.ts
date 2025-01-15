import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { Server } from 'socket.io';
import http from 'http';
import cors from 'cors';

const app = express();
const PORT = 3000;

// Enable CORS for the entire backend
app.use(
  cors({
    origin: ['http://localhost:3001', 'http://192.168.1.76:3001'], // Frontend URL
    methods: ['GET', 'POST'],
  })
);

// Set up the websocket server for updating the client with progress info
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3001', 'http://192.168.1.76:3001'], // Frontend URL
    methods: ['GET', 'POST'],
  },
  transports: ['websocket'],
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Middleware for logging upload progress
const logUploadProgress = (req: Request, res: Response, next: NextFunction) => {
  const totalSize = parseInt(req.headers['content-length'] || '0', 10);
  let uploadedSize = 0;

  req.on('data', (chunk: Buffer) => {
    uploadedSize += chunk.length;
    const progress = (uploadedSize / totalSize) * 100;
    io.emit('uploadProgress', { progress });
  });

  next();
};

// Routes
app.post(
  '/upload',
  logUploadProgress,
  upload.single('file'),
  (req: Request, res: Response) => {
    logMsg(`File uploaded successfully: ${req.file?.filename}`);
    logMsg(
      `Starting transcription process (${req.body.language}). Please wait.`
    );
    if (req.file) {
      exec(
        // This is the shell script that performs the transcription of the uploaded audio/video
        `bash /var/www/rec_transc_backend/run_whisper.sh '${req.file.path}' ${req.body.language}`,
        (error, stdout, stderr) => {
          logMsg(`Transcripition process completed.`);
          if (req.file) {
            // The transcript file in the best format is VTT which we can get by modifying the extension of the uploaded file
            fs.readFile(
              `${req.file.path.replace(/\.[^/.]+$/, '.vtt')}`,
              'utf8',
              (err, data) => {
                if (err) {
                  logMsg(`Error reading file: ${err.message}`);
                  return;
                }

                // Convert the VTT file to HTML table markup
                const lines = data.split('\n');
                const trimmedLines = lines
                  .slice(1)
                  .map((line) => line.trim())
                  .join('\n');
                const rows = trimmedLines.trim().trim().split('\n\n');
                let tableHTML = `<h1>Transcript Viewer</h1><h3>Notes:</h3><ul><li>You can combine rows by clicking and dragging accross two or more of them.</li><li>Every time you combine cells the table is copied to the clipboard so you can paste it into some other application.</li></ul><br><table id="transcTable"><thead><tr><th>Timestamp</th><th>Text</th></tr></thead><tbody>`;
                let id = 0;
                rows.forEach((row) => {
                  const [timestamp, ...text] = row.split('\n');
                  const textContent = text.join(' ').trim();
                  tableHTML += `<tr id="${id++}"><td>${timestamp}</td><td>${textContent}</td></tr>`;
                });
                tableHTML += `</tbody></table>`;
                tableHTML = tableHTML.replace(/ --> /g, '&rarr;');
                io.emit('transcriptionComplete', tableHTML);
              }
            );
          } else {
            logMsg('Error: req.file is undefined.');
          }
        }
      );
    } else {
      logMsg('File upload failed: req.file is undefined.');
    }
  }
);

// For debugging/troubleshooting
app.get('/', (req, res) => {
  res.send('CORS is configured!');
});

// Start server
server.listen(PORT, () => {
  logMsg(`Server is running on http://192.168.1.76:${PORT}`);
});

function logMsg(msg: string) {
  const now = new Date();

  // Format day, month, and year
  const day = String(now.getDate()).padStart(2, '0');
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = monthNames[now.getMonth()];
  const year = now.getFullYear();

  // Format hours, minutes, seconds
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';

  // Convert to 12-hour format
  hours = hours % 12 || 12; // Convert hour '0' to '12'

  // Assemble the final formatted time and add the log message
  const formattedMsg = `${day}-${month}-${year} ${hours}:${minutes}:${seconds} ${ampm}: ${msg}`;
  console.log(formattedMsg);
}
