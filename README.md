# Wayfarer — AI Travel Planner

A fully client-side, framework-free AI travel planner. Enter your trip details, and Groq's llama-3.3-70b-versatile model generates a complete 17-section Markdown itinerary — displayed, savable, and exportable, entirely in your browser.

Stack


HTML5 / CSS3 / vanilla JavaScript — no React, Vue, Node, or backend
Groq API for AI generation (bring your own key)
marked.js (via CDN) for Markdown rendering
localStorage for API key, saved trips, and history


Getting started


Open index.html in any modern browser (double-click, or serve it locally).
Click Settings in the nav bar and paste in a Groq API key from console.groq.com/keys.
Click Save API key, then Test connection to confirm it works.
Fill in the trip planner form and click Generate AI Travel Plan.


No build step, no install — it's a static site.

Features


Trip planner form: destination, dates/duration, travelers, budget, currency, travel style, transportation, accommodation, interests, food preference, and notes
17-section AI-generated itinerary rendered as formatted Markdown (overview, daily schedule, budget, packing list, safety tips, local phrases, and more)
Copy, print, download as TXT, download as PDF (via print dialog), save, share, and regenerate actions on every plan
My Trips: saved itineraries with destination, date, duration, budget, view and delete
History: every generated plan, searchable by destination, with a clear-all option
Settings modal: API key entry with show/hide toggle, save, remove, test connection, and a live status indicator
Light/dark theme toggle, persisted across sessions
Responsive layout, keyboard-navigable, visible focus states, prefers-reduced-motion respected
Toast notifications for success/error/info states, inline form validation, and network/API error handling


Folder structure

AI-Travel-Planner/
├── index.html
├── style.css
├── script.js
├── assets/
│   ├── images/
│   ├── icons/
│   └── animations/
└── README.md

Privacy

Your API key and every itinerary you generate are stored only in this browser's localStorage. Nothing is sent anywhere except directly to the Groq API when you generate a plan.