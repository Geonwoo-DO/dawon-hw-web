# 📒 Student Homework & Message Submission Web App

This is a web application for students to submit homework and messages, while teachers can review them via a dashboard.

## 🚀 Features
- **Student Submission:** Students can submit messages along with a title.
- **Teacher Dashboard:** Teachers can view submitted messages (only name and title).
- **Detailed View:** Clicking a message in the dashboard opens a new link showing full content.
- **Unique Message URLs:** Messages are accessible via unique URLs (e.g., `/teacher/v/{messageUID}`).
- **Teacher Registration Control:** Only logged-in teachers can register new teacher accounts.

## 🛠️ Tech Stack
- **Backend:** Node.js, Express
- **Frontend:** EJS, HTML, CSS
- **Database:** (Specify your DB, e.g., MongoDB, MySQL, etc.)

## 📦 Installation & Setup

### 1. Clone the Repository
```sh
git clone https://github.com/Geonwoo-DO/dawon-hw-web.git
cd dawon-hw-web
```

### 2. Install Dependencies
```sh
npm install bcryptjs@3.0.1 body-parser@1.20.3 csurf@1.10.0 date-fns@4.1.0 ejs@3.1.10 express-session@1.18.1 express@4.21.2 multer@1.4.5-lts.1 socket.io@4.8.1 uuidv4@6.2.13
```

### 3. Run the Application
```sh
node app.js
```

## 📌 API Routes

### **Student Routes**
- `POST /submit` → Submit a message

### **Teacher Routes**
- `GET /dashboard` → View all submissions (names & titles only)
- `GET /teacher/v/{messageUID}` → View full message details

## 🔒 Authentication & Authorization
- **Student Access:** Can submit messages.
- **Teacher Access:** Must be logged in to view messages.
- **Teacher Registration:** Only existing teachers can create new teacher accounts.

## 📜 License
This project is licensed under the MIT License.

## 🤝 Contributing
Feel free to submit pull requests and open issues to improve this project!

## 📧 Contact
For any questions, reach out via GitHub Issues or email: `geonwoocoding@gmail.com`

