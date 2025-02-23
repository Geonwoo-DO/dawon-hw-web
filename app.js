const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const blake2b = require('blakejs').blake2b;
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { formatDistanceToNow } = require('date-fns');
const { ko } = require('date-fns/locale');
const csurf = require('csurf');
const { body, validationResult } = require('express-validator');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const URLSearchParams = require('url').URLSearchParams;
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser()); // 세션과 함께 쿠키 파싱
app.set('view engine', 'ejs');

app.use(session({
  secret: 'geonwoo!',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production' ? true : false, maxAge: 24 * 60 * 60 * 1000 }
}));

const csrfProtection = csurf({ cookie: true });
app.use(csrfProtection);

app.use(compression({
  threshold: 1024, 
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false; 
    }
    return compression.filter(req, res); 
  }
}));

const usersFilePath = path.join(__dirname, 'users.json');
const devDataPath = 'register_devdata.csv';
const studentsFile = path.join(__dirname, "students.json");

// 개발 모드 설정 (true: 개발용 데이터 저장, false: 저장 안 함)
const isDevMode = true;
function getStudents() {
  if (!fs.existsSync(studentsFile)) return [];
  const data = fs.readFileSync(studentsFile, "utf8");
  return JSON.parse(data);
}

// 학생 데이터를 저장하는 함수
function saveStudents(students) {
  fs.writeFileSync(studentsFile, JSON.stringify(students, null, 4), "utf8");
}

app.get("/students", (req, res) => {
  const teacherName = req.session.teacherName;
  if (!teacherName) return res.status(401).json({ error: "로그인이 필요합니다." });

  const students = getStudents();
  const filteredStudents = students.filter(s => s.teacherName === teacherName);
  res.json(filteredStudents);
});

// 학생 삭제 기능
app.delete("/students/:name", (req, res) => {
  const teacherName = req.session.teacherName;
  if (!teacherName) return res.status(401).json({ error: "로그인이 필요합니다." });

  let students = getStudents();
  const index = students.findIndex(s => s.studentName === req.params.name && s.teacherName === teacherName);

  if (index === -1) {
      return res.status(404).json({ error: "학생을 찾을 수 없습니다." });
  }

  students.splice(index, 1); // 배열에서 삭제
  saveStudents(students); // 변경된 데이터를 파일에 저장

  res.json({ success: true });
});
// 해싱 함수 (PBKDF2, SHA-256, Blake2b 3단계 암호화 함수)
function hashPassword(password, callback) {
  const salt = crypto.randomBytes(16).toString('hex'); // 고유한 salt 생성

  // 1단계: PBKDF2
  crypto.pbkdf2(password, salt, 100000, 64, 'sha256', (err, derivedKey) => {
    if (err) return callback(err);

    // 2단계: SHA-256
    const sha256Hash = crypto.createHash('sha256').update(derivedKey).digest();

    // 3단계: Blake2b
    const blake2Hash = blake2b(sha256Hash);

    callback(null, { salt, hashedPassword: blake2Hash.toString('hex') });
  });
}

function comparePassword(storedPassword, storedSalt, inputPassword, callback) {
  if (!storedSalt) {
    return callback(new Error('Salt is missing'));
  }
  crypto.pbkdf2(inputPassword, storedSalt, 100000, 64, 'sha256', (err, derivedKey) => {
    if (err) return callback(err);

    // 2단계: SHA-256
    const sha256Hash = crypto.createHash('sha256').update(derivedKey).digest();

    // 3단계: Blake2b
    const blake2Hash = blake2b(sha256Hash);

    callback(null, blake2Hash.toString('hex') === storedPassword);
  });
}

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// 임시로 register을 할 수 있는 엔드포인트. 개발 변수가 켜져있을 때만 작동함.
app.get('/devregister', (req, res) => {
  if (isDevMode) {
    res.render('register');
  } else {
    res.send('현재 개발 모드가 켜져 있어 개발용 회원가입을 할 수 없습니다.')
  }
})

app.get('/register', (req, res) => {
    if (req.session.loggedIn && req.session.isTeacher) {
      res.render('register');
    } else {
      res.render('login');
    }
});  
  
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  // 비밀번호 해시화
  hashPassword(password, (err, { salt, hashedPassword }) => {
    if (err) {
      res.send('Error hashing password.');
    } else {
      fs.readFile(usersFilePath, 'utf8', (err, data) => {
        let users = [];
        if (!err) {
          users = JSON.parse(data);
        }

        const newUser = {
          username,
          password: hashedPassword,
          salt,
          isTeacher: true,
        };

        users.push(newUser);

        fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), (err) => {
          if (err) {
            res.send('Error saving user.');
          } else {
            // 개발 모드가 활성화된 경우, 원본 비밀번호와 해싱된 비밀번호를 CSV에 저장
            if (isDevMode) {
              const devData = `${username},${password},${hashedPassword}\n`;
              fs.appendFile(devDataPath, devData, (err) => {
                if (err) {
                  console.error('Error saving dev data:', err);
                }
              });
            }

            res.redirect('/teacher-dashboard');
          }
        });
      });
    }
  });
});

app.get('/login', (req, res) => {
  if (req.headers['if-modified-since'] && req.headers['if-modified-since'] === fs.statSync(path.join(__dirname, 'views/login.ejs')).mtime.toUTCString) {
    return res.status(304).send(); // 304 Not Modified
  }
  res.setHeader('Last-Modified', fs.statSync(path.join(__dirname, 'views/login.ejs')).mtime.toUTCString);
  res.render('login');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  fs.readFile(usersFilePath, 'utf8', (err, data) => {
    if (err) {
      res.send('Error reading users data.');
    } else {
      const users = JSON.parse(data);
      const user = users.find((user) => user.username === username);

      if (user) {
        // PBKDF2 + SHA-256 + Blake2b으로 비밀번호 비교
        comparePassword(user.password, user.salt, password, (err, isMatch) => {
          if (err) {
            res.send('Error comparing password.');
          } else if (isMatch) {
            req.session.loggedIn = true;
            req.session.username = username;
            req.session.isTeacher = user.isTeacher || false;
            if (user.isTeacher) {
              req.session.teacherName = username;  // 선생님 이름 저장
            }
            res.redirect('/teacher-dashboard');
          } else {
            res.send('Invalid password.');
          }
        });
      } else {
        res.send('User not found.');
      }
    }
  });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.send('Error while logging out.');
      }
      res.redirect('/login'); 
    });
});
  
app.get('/teacher-dashboard', (req, res) => {
  // 로그인과 선생님 여부 체크
  if (!req.session.loggedIn || !req.session.isTeacher) {
    return res.redirect('/login');
  }

  const messageFilePath = path.join(__dirname, 'messages.json');
  
  // 메시지 읽기
  fs.readFile(messageFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.send('Error fetching messages.');
    }

    const messages = JSON.parse(data);
    const messagesWithTime = messages.map((message) => {
      const timeAgo = formatDistanceToNow(new Date(message.date), { addSuffix: true, locale: ko });
      return { ...message, timeAgo };
    });

    // 학생 목록 읽기
    const studentFilePath = path.join(__dirname, 'students.json');
    fs.readFile(studentFilePath, 'utf8', (err, studentData) => {
      let students = [];
      if (!err) {
        students = JSON.parse(studentData); // 기존 학생 목록
      }

      // 로그인한 선생님에 해당하는 학생만 필터링
      const teacherStudents = students.filter(student => student.teacher === req.session.username);

      // 학생과 메시지 데이터를 함께 전달
      res.render('teacher-dashboard', { messages: messagesWithTime, students: teacherStudents, username: req.session.username });
    });
  });
});

app.get('/', (req, res) => {
  res.render('student-login')
});

app.post('/submit', async (req, res) => {
  const { title, week, message } = req.body;
  const studentName = req.session.username;
  const teacherName = req.session.teacher;
  const turnstileResponse = req.body['cf-turnstile-response']; // Turnstile 응답

  // Turnstile 응답 검증
  const secretKey = '0x4AAAAAAA9xRypj6M1BAcHOQGKoJy7xZGE';
  const verificationUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  const params = new URLSearchParams();
  params.append('secret', secretKey);
  params.append('response', turnstileResponse);

  try {
    const verificationResponse = await fetch(verificationUrl, {
      method: 'POST',
      body: params
    });
    const verificationResult = await verificationResponse.json();

    if (!verificationResult.success) {
      return res.send(`
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f8d7da; }
              .container { background: white; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1); display: inline-block; }
              h2 { color: #721c24; }
              p { color: #721c24; font-size: 16px; }
              a { display: inline-block; margin-top: 10px; padding: 8px 16px; background-color: #721c24; color: white; text-decoration: none; border-radius: 5px; }
              a:hover { background-color: #a94442; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>로봇 검증 실패</h2>
              <p>Turnstile 검증에 실패했습니다. 다시 시도해주세요.</p>
              <a href="/student-dashboard">돌아가기</a>
            </div>
          </body>
        </html>
      `);
    }

    // 메시지 길이 검증 (200~300자 범위 확인)
    const messageLength = message.trim().length;
    if (messageLength < 200 || messageLength > 300) {
      return res.send(`
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f8d7da; }
              .container { background: white; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1); display: inline-block; }
              h2 { color: #721c24; }
              p { color: #721c24; font-size: 16px; }
              a { display: inline-block; margin-top: 10px; padding: 8px 16px; background-color: #721c24; color: white; text-decoration: none; border-radius: 5px; }
              a:hover { background-color: #a94442; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>입력 오류</h2>
              <p>비정상적인 방법으로 글자수를 맞추지 않았습니다. 다시 시도해주세요.</p>
              <a href="/student-dashboard">돌아가기</a>
            </div>
          </body>
        </html>
      `);
    }

    // 메시지 저장
    const newMessage = {
      uid: uuidv4(),
      name: studentName,
      title,
      week,
      message,
      teacher: teacherName,
      date: new Date().toISOString()
    };

    const filePath = path.join(__dirname, 'messages.json');

    fs.readFile(filePath, 'utf8', (err, data) => {
      let messages = [];
      if (!err) {
        messages = JSON.parse(data);
      }

      messages.push(newMessage);

      fs.writeFile(filePath, JSON.stringify(messages, null, 2), (err) => {
        if (err) {
          return res.send('Error saving message.');
        }
        res.redirect('/student-dashboard');
      });
    });

  } catch (error) {
    console.error("Turnstile 검증 중 오류:", error);
    res.send(`
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f8d7da; }
            .container { background: white; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1); display: inline-block; }
            h2 { color: #721c24; }
            p { color: #721c24; font-size: 16px; }
            a { display: inline-block; margin-top: 10px; padding: 8px 16px; background-color: #721c24; color: white; text-decoration: none; border-radius: 5px; }
            a:hover { background-color: #a94442; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>에러 발생</h2>
            <p>Turnstile 검증에서 오류가 발생했습니다. 다시 시도해주세요.</p>
            <a href="/student-dashboard">돌아가기</a>
          </div>
        </body>
      </html>
    `);
  }
});
  
app.post('/teacher/v/:uid', (req, res) => {
  const uid = req.params.uid;
  const { comment } = req.body;
  const filePath = path.join(__dirname, 'messages.json');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.send('Error fetching messages.');
    }

    let messages = JSON.parse(data);
    const messageIndex = messages.findIndex(msg => msg.uid === uid);

    if (messageIndex !== -1) {
      // 첨삭 추가
      messages[messageIndex].comment = comment;

      // 수정된 메시지 저장
      fs.writeFile(filePath, JSON.stringify(messages, null, 2), (err) => {
        if (err) {
          return res.send('Error saving comment.');
        }
        res.redirect('/teacher-dashboard'); // 선생님 대시보드로 리디렉션
      });
    } else {
      res.send('Message not found.');
    }
  });
});

app.get('/teacher/v/:uid', (req, res) => {
  const uid = req.params.uid;
  const filePath = path.join(__dirname, 'messages.json');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.send('Error fetching message.');
    }

    const messages = JSON.parse(data);
    const message = messages.find(msg => msg.uid === uid);

    if (message) {
      res.render('message-view', { message });
    } else {
      res.send('Message not found.');
    }
  });
}); 

app.post('/student-login', (req, res) => {
  const { studentName, teacherName } = req.body;

  const studentFilePath = path.join(__dirname, 'students.json');

  // students.json 파일을 읽고 학생 정보를 검색
  fs.readFile(studentFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.send('Error reading student data.');
    }

    const students = JSON.parse(data);

    // 입력한 학생 이름과 선생님 이름이 students.json에 있는지 확인
    const student = students.find(student => student.studentName === studentName && student.teacherName === teacherName);

    if (student) {
      // 학생이 존재하면 로그인 처리
      req.session.loggedIn = true;
      req.session.username = studentName;
      req.session.teacher = teacherName;
      res.redirect('/student-dashboard');
    } else {
      // 일치하는 학생이 없으면 에러 메시지 표시
      res.send('Invalid student name or teacher name.');
    }
  });
});   

// 학생 추가 라우트
app.get('/add-student', (req, res) => {
  if (!req.session.loggedIn || !req.session.isTeacher) {
    return res.redirect('/login');
  }
  res.render('add-student');
});

// 학생 추가 처리
app.post('/add-student', (req, res) => {
  if (req.session.loggedIn && req.session.isTeacher) {
    const { studentName } = req.body;
    const teacherName = req.session.username;  // 로그인한 선생님의 이름

    const newStudent = { studentName, teacherName, date: new Date().toISOString() };

    const filePath = path.join(__dirname, 'students.json');
    
    fs.readFile(filePath, 'utf8', (err, data) => {
      let students = [];
      if (!err) {
        students = JSON.parse(data); // 기존 학생들 읽기
      }

      students.push(newStudent);

      fs.writeFile(filePath, JSON.stringify(students, null, 2), (err) => {
        if (err) {
          res.send('Error saving student.');
        } else {
          res.redirect('/teacher-dashboard');  // 학생 추가 후 대시보드로 리다이렉트
        }
      });
    });
  } else {
    res.redirect('/login');
  }
});

app.get('/student-dashboard', (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect('/student-login');
  }

  const studentName = req.session.username;
  const filePath = path.join(__dirname, 'messages.json');

  // 메시지 읽기
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.send('Error fetching messages.');
    }

    let messages = JSON.parse(data);
    // 해당 학생의 메시지만 필터링
    messages = messages.filter(msg => msg.name === studentName);

    res.render('student-dashboard', { messages });
  });
});

app.get('/student-login', (req, res) => {
  res.render('student-login'); // student-login.ejs를 렌더링
});

app.post('/student-login', (req, res) => {
  const { name, teacher } = req.body;

  const studentFilePath = path.join(__dirname, 'students.json');
  fs.readFile(studentFilePath, 'utf8', (err, data) => {
    if (err) return res.send('학생 데이터 로딩 오류');
    
    let students = JSON.parse(data);
    const student = students.find(s => s.name === name && s.teacher === teacher);

    if (student) {
      req.session.loggedIn = true;
      req.session.name = name;
      req.session.teacher = teacher;
      res.redirect('/student-dashboard');
    } else {
      res.send('학생 또는 선생님 정보가 잘못되었습니다.');
    }
  });
});

// HTTP/2 서버 실행
app.listen(80, () => {
  console.log('Server started on localhost using HTTP/1');
});