import React from 'react';
import { useNavigate } from 'react-router-dom';

const VideoCall: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '20px' }}>
      <h2>Legacy Video Call</h2>
      <p>This page has been deprecated. Please use the new video call system.</p>
      <button onClick={() => navigate('/call')}>Go to New Video Call</button>
    </div>
  );
};

export default VideoCall;
