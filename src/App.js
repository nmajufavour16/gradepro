import React, { useState, useEffect } from 'react';

// Course database
const courseDB = {
  "100 Level": {
    "First Semester": [
      { "name": "MTH101", "creditUnit": 3 },
      { "name": "PHY101", "creditUnit": 3 },
      { "name": "GNS101", "creditUnit": 2 }
    ],
    "Second Semester": [
      { "name": "CHM102", "creditUnit": 3 },
      { "name": "CSC102", "creditUnit": 2 }
    ]
  },
  "200 Level": {
    "First Semester": [],
    "Second Semester": []
  },
  "300 Level": {
    "First Semester": [],
    "Second Semester": []
  },
  "400 Level": {
    "First Semester": [],
    "Second Semester": []
  }
};

// Utility functions
function getGradePoint(grade) {
    const gradeMap = {
        'A': 5.0, 'B': 4.0, 'C': 3.0, 'D': 2.0, 'E': 1.0, 'F': 0.0
    };
    return gradeMap[grade?.toUpperCase()] || 0.0;
}

function calculateSGPA(courses) {
    if (!courses || courses.length === 0) return '0.00';
    
    let totalPoints = 0;
    let totalUnits = 0;
    
    courses.forEach(course => {
        const points = getGradePoint(course.grade) * course.creditUnit;
        totalPoints += points;
        totalUnits += course.creditUnit;
    });
    
    return totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00';
}

function calculateCGPA(semesters) {
    if (!semesters || semesters.length === 0) {
        return { cgpa: '0.00', totalCreditUnits: 0 };
    }
    
    let totalPoints = 0;
    let totalUnits = 0;
    
    semesters.forEach(semester => {
        semester.courses?.forEach(course => {
            const points = getGradePoint(course.grade) * course.creditUnit;
            totalPoints += points;
            totalUnits += course.creditUnit;
        });
    });
    
    return {
        cgpa: totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00',
        totalCreditUnits: totalUnits
    };
}

const generateId = () => Math.random().toString(36).substr(2, 9);

// CourseInputRow Component
function CourseInputRow({ course, onCourseChange, onRemoveCourse, availableCourses, onAddFromDropdown }) {
    return (
        <div className="course-row">
            <input
                type="text"
                placeholder="Course Code (e.g., MTH101)"
                value={course.name || ''}
                onChange={(e) => onCourseChange(course.id, 'name', e.target.value)}
            />
            <select
                value={course.creditUnit || 1}
                onChange={(e) => onCourseChange(course.id, 'creditUnit', parseInt(e.target.value))}
            >
                <option value={1}>1 Units</option>
                <option value={2}>2 Units</option>
                <option value={3}>3 Units</option>
                <option value={4}>4 Units</option>
                <option value={5}>5 Units</option>
            </select>
            <select
                value={course.grade || ''}
                onChange={(e) => onCourseChange(course.id, 'grade', e.target.value)}
            >
                <option value="">Select Grade</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
                <option value="F">F</option>
            </select>
            <select onChange={onAddFromDropdown}>
                <option value="">Select course...</option>
                {availableCourses.map(courseOption => (
                    <option key={courseOption.name} value={`${courseOption.name}|${courseOption.creditUnit}`}>
                        {courseOption.name} ({courseOption.creditUnit} Units)
                    </option>
                ))}
            </select>
            <button className="remove-course-btn" onClick={() => onRemoveCourse(course.id)}>
                X
            </button>
        </div>
    );
}

// SemesterSummary Component
function SemesterSummary({ semester, sgpa, onDeleteSemester }) {
    return (
        <div className="semester-summary">
            <div className="semester-header-controls">
                <h4>{semester.semesterName}: SGPA = {sgpa}</h4>
                <div className="semester-buttons">
                    <button className="edit-semester-btn" onClick={() => alert('Edit functionality coming soon!')}>
                        Edit
                    </button>
                    <button className="delete-semester-btn" onClick={() => onDeleteSemester(semester.id)}>
                        Delete
                    </button>
                </div>
            </div>
            <ul>
                {semester.courses?.map((c, index) => (
                    <li key={index}>
                        {c.name} ({c.creditUnit} units): {c.grade}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// Main App Component
function App() {
    const [semesters, setSemesters] = useState([]);
    const [selectedLevel, setSelectedLevel] = useState('100 Level');
    const [selectedSemesterType, setSelectedSemesterType] = useState('First Semester');
    const [currentSemesterCourses, setCurrentSemesterCourses] = useState([
        { id: generateId(), name: '', creditUnit: 1, grade: '' }
    ]);

    const availableCourses = courseDB[selectedLevel]?.[selectedSemesterType] || [];
    const { cgpa: overallCgpa, totalCreditUnits } = calculateCGPA(semesters);

    // Load data from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem('gradeProNGData');
            if (stored) {
                setSemesters(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }, []);

    // Save data to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('gradeProNGData', JSON.stringify(semesters));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }, [semesters]);

    const handleAddFromDropdown = (e) => {
        const [name, creditUnit] = e.target.value.split("|");
        if (!name) return;
        
        setCurrentSemesterCourses(prev => [...prev, {
            id: generateId(),
            name,
            creditUnit: parseInt(creditUnit),
            grade: ''
        }]);
        e.target.value = '';
    };

    const handleAddCourseRow = () => {
        setCurrentSemesterCourses(prev => [...prev, { 
            id: generateId(), 
            name: '', 
            creditUnit: 1, 
            grade: '' 
        }]);
    };

    const handleRemoveCourseRow = (id) => {
        setCurrentSemesterCourses(prev => prev.filter(course => course.id !== id));
    };

    const handleCourseChange = (id, field, value) => {
        setCurrentSemesterCourses(prev => 
            prev.map(course => 
                course.id === id ? { ...course, [field]: value } : course
            )
        );
    };

    const handleAddSemester = () => {
        const validCourses = currentSemesterCourses.filter(
            c => c.name?.trim() && c.creditUnit > 0 && c.grade
        );

        if (validCourses.length === 0) {
            alert("Please add at least one valid course for the semester.");
            return;
        }

        const newSemester = {
            id: generateId(),
            semesterName: `${selectedLevel} - ${selectedSemesterType}`,
            courses: validCourses
        };

        setSemesters(prev => [...prev, newSemester]);
        setCurrentSemesterCourses([{ id: generateId(), name: '', creditUnit: 1, grade: '' }]);
    };

    const handleDeleteSemester = (idToDelete) => {
        if (window.confirm("Are you sure you want to delete this semester?")) {
            setSemesters(prev => prev.filter(sem => sem.id !== idToDelete));
        }
    };

    const handleClearAllData = () => {
        if (window.confirm("Are you sure you want to clear ALL your academic data?")) {
            setSemesters([]);
            alert("All data cleared successfully!");
        }
    };

    return (
        <div>
            <header>
                <h1>GradePro NG</h1>
                <p>Your academic progress, simplified.</p>
            </header>

            <main>
                <section className="semester-input">
                    <h2>Add Semester Courses</h2>
                    
                    <div className="input-group">
                        <label htmlFor="levelSelect">Level:</label>
                        <select
                            id="levelSelect"
                            value={selectedLevel}
                            onChange={(e) => setSelectedLevel(e.target.value)}
                        >
                            <option value="100 Level">100 Level</option>
                            <option value="200 Level">200 Level</option>
                            <option value="300 Level">300 Level</option>
                            <option value="400 Level">400 Level</option>
                        </select>
                    </div>

                    <div className="input-group">
                        <label htmlFor="semesterTypeSelect">Semester Type:</label>
                        <select
                            id="semesterTypeSelect"
                            value={selectedSemesterType}
                            onChange={(e) => setSelectedSemesterType(e.target.value)}
                        >
                            <option value="First Semester">First Semester</option>
                            <option value="Second Semester">Second Semester</option>
                        </select>
                    </div>

                    <div className="input-group">
                        <label>Semester Name:</label>
                        <input
                            type="text"
                            value={`${selectedLevel} - ${selectedSemesterType}`}
                            readOnly
                            className="read-only-input"
                        />
                    </div>

                    <div id="coursesContainer">
                        {currentSemesterCourses.map(course => (
                            <CourseInputRow
                                key={course.id}
                                course={course}
                                onCourseChange={handleCourseChange}
                                onRemoveCourse={handleRemoveCourseRow}
                                availableCourses={availableCourses}
                                onAddFromDropdown={handleAddFromDropdown}
                            />
                        ))}
                    </div>

                    <button onClick={handleAddCourseRow}>Add Another Course</button>
                    <button onClick={handleAddSemester}>Calculate Semester & Add</button>
                </section>

                <section className="results">
                    <h2>Your Academic Summary</h2>
                    
                    <div id="semesterResults">
                        {semesters.length === 0 ? (
                            <p className="no-data-message">
                                No semesters added yet. Start by adding your first semester!
                            </p>
                        ) : (
                            semesters.map(sem => (
                                <SemesterSummary
                                    key={sem.id}
                                    semester={sem}
                                    sgpa={calculateSGPA(sem.courses)}
                                    onDeleteSemester={handleDeleteSemester}
                                />
                            ))
                        )}
                    </div>

                    <div className="overall-cgpa">
                        <h3>Overall CGPA: <span id="overallCgpa">{overallCgpa}</span></h3>
                        <p>Total Credit Units: {totalCreditUnits}</p>
                    </div>

                    <button className="clear-all-data-btn" onClick={handleClearAllData}>
                        Clear All My Data
                    </button>
                </section>
            </main>

            <footer>
                <p>&copy; 2025 GradePro NG. All rights reserved.</p>
            </footer>
        </div>
    );
}

export default App;
