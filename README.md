# HEALTHCARE ECLIPSE
🏥 Healthcare Eclipse
Healthcare Eclipse is a modern, responsive web application prototype for a patient and doctor management system. It features separate dashboards for different user roles, enabling secure login, health record management, and an innovative AI-powered analysis tool, all built with a focus on modern UI/UX principles, including a native dark mode.

✨ Features
Role-Based Dashboards: Separate, secure dashboards for Patients and Doctors.

User Authentication: Full user flow including Registration and Login pages.

Registration allows selecting a role (Patient or Doctor).

MedBot AI Integration: The Patient Dashboard includes a simulated MedBot AI analysis feature, providing insights based on submitted health records.

Appointment Management: The Doctor Dashboard displays pending Appointment Requests.

Modern Design: Utilizes a clean, minimal design language with custom CSS animations and styles (e.g., animated nav links, glowing buttons).

Dark Mode Support: Seamless light/dark theme switching is implemented across the entire application using Tailwind CSS classes.

🛠️ Tech Stack
This project is a static front-end prototype designed for easy deployment and viewing.

HTML5: The core structure of all pages.

Tailwind CSS: Used for rapid and responsive styling, including dark mode configuration (darkMode: 'class').

CDN Usage: Styles are loaded directly via the Tailwind CDN for simplicity.

Vanilla JavaScript: Used for interactive elements, theme persistence, form handling (mock logic), and modal functionality.

🚀 Installation and Usage
Since this is a client-side prototype, no complex server setup is required.

Local Setup
Clone the Repository:

Bash

git clone [Your-Repo-URL]
cd healthcare-eclipse
Open in Browser:

Simply open the frontpage.html file in your web browser.

To test the role-based flow, navigate to registration.html to register a new user as either a "Patient" or "Doctor", and then use login.html.

File Structure
The project is structured with individual HTML files representing different application views:

.
├── About.html        # Information about the project or team.
├── doctor.html       # Doctor's dashboard view.
├── features.html     # Page detailing the main features.
├── frontpage.html    # The main landing/homepage.
├── login.html        # User login page.
├── patient.html      # Patient's dashboard view.
└── registration.html # New user registration page.
Note: External dependencies like a shared script.js file (mentioned in doctor.html) and image assets (logo.png mentioned in features.html) are assumed to be present for full functionality, but the core logic is embedded in the HTML files.
