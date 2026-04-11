import { useState } from 'react';
import usersDataRaw from '../json/users.json'; 

export function useLoginLogic(onLoginSuccess) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isFading, setIsFading] = useState(false);

  const usersData = usersDataRaw.users;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = (e) => {
    e.preventDefault();
    
    const userMatch = usersData.find(u => 
      u.username === credentials.username && u.password === credentials.password
    );

    if (userMatch) {
      setError('');
      setIsFading(true); 
      
      setTimeout(() => {
        // This line was failing because onLoginSuccess was undefined
        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess();
        } else {
          console.error("onLoginSuccess is not a function. Check App.jsx and Login.jsx wiring.");
        }
      }, 3000); 
    } else {
      setError('the user info that has been entered is not registered');
    }
  };

  const isButtonDisabled = !credentials.username.trim() || !credentials.password.trim();

  return { 
    credentials, 
    error, 
    isFading, 
    isButtonDisabled, 
    handleChange, 
    handleLogin 
  };
}