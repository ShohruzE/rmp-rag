'use client'
import { useState } from "react";
import ReactMarkdown from 'react-markdown';

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm the Rate My Professor support assistant. How can I help you today?"
    }
  ]);
  const [message, setMessage] = useState('');
  const [showInput, setShowInput] = useState(false); 
  const [professorUrl, setProfessorUrl] = useState(''); 

  const sendMessage = async () => {
    if (!message.trim()) return;

    setMessages((messages) => [
      ...messages,
      { role: "user", content: message },
      { role: "assistant", content: "" }
    ]);

    setMessage('');

    const response = await fetch('/api/chat', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify([...messages, { role: "user", content: message }])
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let result = "";
    reader.read().then(function processText({ done, value }) {
      if (done) return;
      const text = decoder.decode(value, { stream: true });
      setMessages((messages) => {
        let lastMessage = messages[messages.length - 1];
        let otherMessages = messages.slice(0, messages.length - 1);
        return [
          ...otherMessages,
          { ...lastMessage, content: lastMessage.content + text }
        ];
      });
      return reader.read().then(processText);
    });
  };

  const addProfessor = async () => {
    if (!professorUrl.trim()) return;
  
    const response = await fetch('/api/scrape-professor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: professorUrl })
    });
  
    const scrapedInfo = await response.json();
  
    if (scrapedInfo.error) {
      setMessages((messages) => [
        ...messages,
        { role: "assistant", content: "Failed to scrape professor details. Please check the URL and try again." }
      ]);
      return;
    }
  
    const comments = scrapedInfo.data.reviews && scrapedInfo.data.reviews.length > 0
      ? scrapedInfo.data.reviews.join('\n')
      : 'No reviews available';
  
    setMessages((messages) => [
      ...messages,
      { role: "user", content: professorUrl },
      { role: "assistant", content: `Professor: ${scrapedInfo.data.professor || 'N/A'}\nStar Rating: ${scrapedInfo.data.star_rating || 'N/A'}\nDepartment: ${scrapedInfo.data.subject || 'N/A'}\nReviews:\n${comments}` }
    ]);
  
    setProfessorUrl('');
    setShowInput(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="p-8 max-w-2xl w-full font-sans text-gray-800">
        <h2 className="text-center text-blue-600 text-2xl mb-6">Rate My Professor Chatbot</h2>
        <div className="h-[500px] overflow-y-auto border border-gray-300 rounded-lg p-6 bg-white mb-6 shadow-md">
          {messages.map((msg, index) => (
            <div key={index} className={`mb-6 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block px-6 py-4 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'} max-w-md shadow-sm`}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-grow px-5 py-3 text-lg rounded-lg border border-gray-300 mr-4 shadow-inner"
            placeholder="Type your message..."
          />
          <button
            onClick={sendMessage}
            className="px-5 py-3 text-lg rounded-lg bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-colors"
          >
            Send
          </button>
        </div>

        {/* add professor btn  */}
        <div className="mt-4">
          <button
            onClick={() => setShowInput(!showInput)}
            className="px-5 py-3 text-lg rounded-lg bg-green-600 text-white shadow-md hover:bg-green-700 transition-colors"
          >
            {showInput ? 'Cancel' : 'Click Here to Add a Professor'}
          </button>

          {showInput && (
            <div className="mt-4">
              <input
                type="text"
                value={professorUrl}
                onChange={(e) => setProfessorUrl(e.target.value)}
                className="flex-grow px-5 py-3 text-lg rounded-lg border border-gray-300 shadow-inner w-full"
                placeholder="Enter Rate My Professor URL..."
              />
              <button
                onClick={addProfessor}
                className="px-5 py-3 mt-4 text-lg rounded-lg bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-colors w-full"
              >
                Add Professor
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
