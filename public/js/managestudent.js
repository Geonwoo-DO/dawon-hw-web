// 학생 목록을 테이블에 표시
async function fetchStudents() {
    const response = await fetch("/students");
    const students = await response.json();

    const tableBody = document.getElementById("student-list");
    tableBody.innerHTML = ""; // 기존 목록 초기화

    students.forEach(student => {
        const row = document.createElement("tr");

        // 학생 이름 셀
        const nameCell = document.createElement("td");
        nameCell.textContent = student.studentName;
        row.appendChild(nameCell);

        // 가입일 셀
        const dateCell = document.createElement("td");
        dateCell.textContent = new Date(student.date).toLocaleDateString();
        row.appendChild(dateCell);

        // 액션 셀 (삭제 버튼)
        const actionsCell = document.createElement("td");
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "삭제";
        deleteBtn.onclick = () => deleteStudent(student.studentName);
        deleteBtn.classList.add("delete-btn");
        actionsCell.appendChild(deleteBtn);
        row.appendChild(actionsCell);

        tableBody.appendChild(row);
    });
}

// 학생 삭제 처리
async function deleteStudent(name) {
    if (!confirm("학생을 삭제하시겠습니까?")) return; // 확인창

    const response = await fetch(`/students/${name}`, { method: "DELETE" });
    const result = await response.json();

    if (result.success) {
        fetchStudents(); // 삭제 후 목록 새로고침
    } else {
        alert("삭제 실패: " + result.error);
    }
}

// 페이지 로드 시 학생 목록 불러오기
fetchStudents();
