import sys
import subprocess
from PyQt5.QtWidgets import QApplication, QWidget, QVBoxLayout, QLineEdit, QPushButton, QFileDialog, QComboBox, QLabel, QCheckBox

class GitHelper(QWidget):
    def __init__(self):
        super().__init__()

        self.initUI()

    def initUI(self):
        self.setWindowTitle("Git Helper")
        
        # Layout setup
        layout = QVBoxLayout()

        # 폴더 선택 체크박스
        self.node_modules_check = QCheckBox("node_modules", self)
        self.tmp_check = QCheckBox(".tmp.driveupload", self)
        self.certs_check = QCheckBox("certs", self)

        # 브랜치 선택 콤보박스
        self.branch_label = QLabel("Select Branch:", self)
        self.branch_combobox = QComboBox(self)
        self.branch_combobox.addItem("main")
        self.branch_combobox.addItem("develop")
        self.branch_combobox.addItem("feature/xyz")

        # 커밋 메시지 입력
        self.commit_message_label = QLabel("Commit Message:", self)
        self.commit_message_input = QLineEdit(self)

        # 실행 버튼
        self.run_button = QPushButton("Execute Git Commands", self)
        self.run_button.clicked.connect(self.run_git_commands)

        # Add widgets to layout
        layout.addWidget(self.node_modules_check)
        layout.addWidget(self.tmp_check)
        layout.addWidget(self.certs_check)
        layout.addWidget(self.branch_label)
        layout.addWidget(self.branch_combobox)
        layout.addWidget(self.commit_message_label)
        layout.addWidget(self.commit_message_input)
        layout.addWidget(self.run_button)

        self.setLayout(layout)

    def run_git_commands(self):
        # .gitignore에 추가할 폴더를 설정
        folders_to_ignore = []
        if self.node_modules_check.isChecked():
            folders_to_ignore.append("node_modules/")
        if self.tmp_check.isChecked():
            folders_to_ignore.append(".tmp.driveupload/")
        if self.certs_check.isChecked():
            folders_to_ignore.append("certs/")

        # .gitignore에 추가
        with open('.gitignore', 'a') as gitignore_file:
            for folder in folders_to_ignore:
                gitignore_file.write(f"{folder}\n")

        # git rm --cached 명령어 실행
        for folder in folders_to_ignore:
            subprocess.run(["git", "rm", "-r", "--cached", folder])

        # Git add, commit, push 실행
        commit_message = self.commit_message_input.text()
        branch = self.branch_combobox.currentText()

        # git add .gitignore
        subprocess.run(["git", "add", ".gitignore"])

        # git commit
        subprocess.run(["git", "commit", "-m", commit_message])

        # git push
        subprocess.run(["git", "push", "origin", branch])

        # 알림 메시지 출력
        print(f"Successfully pushed to {branch} with commit message: '{commit_message}'")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    ex = GitHelper()
    ex.show()
    sys.exit(app.exec_())
