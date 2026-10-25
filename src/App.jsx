import React from 'react';
import Sidebar from './components/Sidebar';

const App = ({ isOpen, onClose }) => {
    return (
        <Sidebar isOpen={isOpen} onClose={onClose} />
    );
};

export default App;
