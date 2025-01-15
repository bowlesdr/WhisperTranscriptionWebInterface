import React from 'react';
import FileUpload from './components/FileUpload'; // Import the FileUpload component

const App: React.FC = () => {
  return (
    <div>
      <h1>Dave's Recording Transcription App</h1>
      <FileUpload /> {/* Use the FileUpload component here */}
    </div>
  );
};

export default App;
