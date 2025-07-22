const { useState, useEffect, useRef } = React;
const { createRoot } = ReactDOM;
import courseDB from './courses.json';
import html2pdf from 'html2pdf.js';

// --- API Key (Canvas will inject this at runtime) ---
const API_KEY = "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"; // Leave this empty, Canvas will provide it. This is not used for OpenRouter API calls.

// --- Core Calculation Functions ---
/**
 * Converts a letter grade to its corresponding grade point on a 5.0 scale.
 * @param {string} grade - The letter grade (e.g., 'A', 'B', 'F').
 * @returns {number} The grade point. Returns 0.0 for invalid grades.
 */
function getGradePoint(grade) {
    grade = grade.toUpperCase();
    switch (grade) {
        case 'A': return 5.0;
        case 'B': return 4.0;
        case 'C': return 3.0;
        case 'D': return 2.0;
        case 'E': return 1.0;
        case 'F': return 0.0;
        default: return 0.0;
    }
}

/**
 * Converts a grade point back to a letter grade based on a 5.0 scale.
 * This is an approximation for display in the target CGPA calculator.
 * @param {number} gradePoint - The numeric grade point.
 * @returns {string} The corresponding letter grade.
 */
function getLetterGrade(gradePoint) {
    if (gradePoint >= 4.5) return 'A';
    if (gradePoint >= 3.5) return 'B';
    if (gradePoint >= 2.5) return 'C';
    if (gradePoint >= 1.5) return 'D';
    if (gradePoint >= 0.5) return 'E';
    return 'F';
}

/**
 * Calculates the Semester Grade Point Average (SGPA) for a given set of courses.
 * @param {Array<Object>} semesterCourses - An array of course objects.
 * @returns {string} The calculated SGPA, formatted to two decimal places.
 */
function calculateSGPA(semesterCourses) {
    let totalGradePoints = 0;
    let totalCreditUnits = 0;

    semesterCourses.forEach(course => {
        const gradePoint = getGradePoint(course.grade);
        totalGradePoints += gradePoint * course.creditUnit;
        totalCreditUnits += course.creditUnit;
    });

    if (totalCreditUnits === 0) {
        return '0.00';
    }
    return (totalGradePoints / totalCreditUnits).toFixed(2);
}

/**
 * Calculates the Cumulative Grade Point Average (CGPA) across all semesters.
 * @param {Array<Object>} allSemesters - An array of semester objects.
 * @returns {Object} An object containing the calculated CGPA (string) and total credit units (number).
 */
function calculateCGPA(allSemesters) {
    let overallTotalGradePoints = 0;
    let overallTotalCreditUnits = 0;

    allSemesters.forEach(semester => {
        semester.courses.forEach(course => {
            const gradePoint = getGradePoint(course.grade);
            overallTotalGradePoints += gradePoint * course.creditUnit;
            overallTotalCreditUnits += course.creditUnit;
        });
    });

    if (overallTotalCreditUnits === 0) {
        return { cgpa: '0.00', totalCreditUnits: 0 };
    }
    return {
        cgpa: (overallTotalGradePoints / overallTotalCreditUnits).toFixed(2),
        totalCreditUnits: overallTotalCreditUnits
    };
}

/**
 * Calculates the average grade point needed in the next semester/level to achieve a target overall CGPA.
 * @param {number} currentCgpa - The student's current overall CGPA.
 * @param {number} currentTotalCreditUnits - The total credit units accumulated so far.
 * @param {number} targetOverallCgpa - The overall CGPA the student is aiming for after the next semester/level.
 * @param {number} nextSemesterCreditUnits - The total credit units for the upcoming semester/level.
 * @returns {number} The average grade point needed for the next semester/level.
 */
function calculateRequiredSGPANextSemester(currentCgpa, currentTotalCreditUnits, targetOverallCgpa, nextSemesterCreditUnits) {
    if (nextSemesterCreditUnits <= 0) {
        return NaN;
    }

    const totalPointsForTargetCgpa = targetOverallCgpa * (currentTotalCreditUnits + nextSemesterCreditUnits);
    const pointsAlreadyEarned = currentCgpa * currentTotalCreditUnits;
    const pointsNeededInNextSemester = totalPointsForTargetCgpa - pointsAlreadyEarned;

    return pointsNeededInNextSemester / nextSemesterCreditUnits;
}

/**
 * Calculates the average credit unit per course from all previously added semesters.
 * @param {Array<Object>} allSemesters - An array of semester objects.
 * @returns {number} The average credit unit per course, or 0 if no courses.
 */
function calculateAverageCreditUnitPerCourse(allSemesters) {
    let totalCoursesCount = 0;
    let totalCreditUnits = 0;

    allSemesters.forEach(semester => {
        semester.courses.forEach(course => {
            totalCoursesCount++;
            totalCreditUnits += course.creditUnit;
        });
    });

    if (totalCoursesCount === 0) {
        return 0;
    }
    return totalCreditUnits / totalCoursesCount;
}


/**
 * Generates a simple unique ID for list items.
 * @returns {string} A unique ID string.
 */
const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Helper function to call OpenRouter API for AI-generated responses.
 * @param {string} prompt - The user prompt.
 * @param {Array} chatHistory - The chat history messages.
 * @returns {Promise<string>} - The AI-generated response text.
 */
async function getAIGeneratedResponse(prompt, chatHistory = []) {
    const OPENROUTER_API_KEY = "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";

    const openRouterApiUrl = "https://openrouter.ai/api/v1/chat/completions";
    const messages = chatHistory.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : msg.role,
        content: msg.parts[0].text
    }));
    messages.push({ role: "user", content: prompt });

    try {
        const response = await fetch(openRouterApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://gradepro.vercel.app',
                'X-Title': 'GradePro NG - CGPA Calculator and AI Study Help',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat:free',
                messages: messages
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenRouter API error response:", errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        if (result.choices && result.choices.length > 0 && result.choices[0].message && result.choices[0].message.content) {
            return result.choices[0].message.content;
        } else {
            console.error("Unexpected AI response structure from OpenRouter:", result);
            return "Sorry, I couldn't generate a response. Please try again.";
        }
    } catch (error) {
        console.error("Error calling OpenRouter API:", error);
        return "I'm having trouble connecting to my brain right now. Please try again later.";
    }
}


/**
 * Analyzes academic performance to identify strengths and weaknesses.
 * @param {Array<Object>} semesters - All recorded semesters.
 * @returns {Object} An object with arrays of strengths and weaknesses (course names).
 */
function analyzeAcademicPerformance(semesters) {
    const strengths = new Set();
    const weaknesses = new Set();
    const courseGrades = {}; // { 'CourseName': [gradePoint1, gradePoint2] }

    semesters.forEach(semester => {
        semester.courses.forEach(course => {
            const gradePoint = getGradePoint(course.grade);
            if (!courseGrades[course.name]) {
                courseGrades[course.name] = [];
            }
            courseGrades[course.name].push(gradePoint);
        });
    });

    for (const courseName in courseGrades) {
        const grades = courseGrades[courseName];
        const avgGradePoint = grades.reduce((sum, gp) => sum + gp, 0) / grades.length;

        // Simple logic: A/B are strengths, D/E/F are weaknesses
        if (avgGradePoint >= 4.0) { // Average B or higher
            strengths.add(courseName);
        } else if (avgGradePoint <= 2.0) { // Average D or lower
            weaknesses.add(courseName);
        }
    }

    return {
        strengths: Array.from(strengths),
        weaknesses: Array.from(weaknesses)
    };
}

// --- CourseInputRow Component ---
function CourseInputRow({ course, onCourseChange, onRemoveCourse, availableCourses, onAddFromDropdown }) {
    return (
        <div className="course-row">
            <input
                type="text"
                className="course-name"
                placeholder="Course Code (e.g., MTH101)"
                value={course.name}
                onChange={(e) => onCourseChange(course.id, 'name', e.target.value)}
            />
            <select
                className="credit-unit"
                value={course.creditUnit}
                onChange={(e) => onCourseChange(course.id, 'creditUnit', parseInt(e.target.value))}
            >
                {[1, 2, 3, 4, 5].map(unit => (
                    <option key={unit} value={unit}>{unit} Units</option>
                ))}
            </select>
            <select
                className="grade"
                value={course.grade}
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
            <select onChange={e => onAddFromDropdown(e)}>
                <option value="">Select course...</option>
                {availableCourses.map(course => (
                    <option key={course.name} value={`${course.name}|${course.creditUnit}`}>
                        {course.name} ({course.creditUnit} Units)
                    </option>
                ))}
            </select>
            <button className="remove-course-btn" onClick={() => onRemoveCourse(course.id)}>X</button>
        </div>
    );
}

const availableCourses = courseDB[selectedLevel]?.[selectedSemesterType] || [];

const handleAddFromDropdown = (e) => {
    const [name, creditUnit] = e.target.value.split("|");
    if (!name) return;
    setCurrentSemesterCourses([...currentSemesterCourses, {
        id: generateId(),
        name,
        creditUnit: parseInt(creditUnit),
        grade: ''
    }]);
};

// Add export to PDF functionality
const handleExportPdf = () => {
    const element = document.querySelector("main");
    html2pdf().from(element).save("CGPA_Summary.pdf");
};

// --- SemesterSummary Component ---
function SemesterSummary({ semester, sgpa, onDeleteSemester }) {
    return (
        <div className="semester-summary">
            <div className="semester-header-controls">
                 <h4>{semester.semesterName}: SGPA = {sgpa}</h4>
                 <div className="semester-buttons">
                     {/* Placeholder for Edit button - functionality to be added later */}
                     <button className="edit-semester-btn" onClick={() => alert('Edit functionality coming soon!')}>Edit</button>
                     <button className="delete-semester-btn" onClick={() => onDeleteSemester(semester.id)}>Delete</button>
                 </div>
            </div>
            <ul>
                {semester.courses.map((c, index) => (
                    <li key={index}>
                        {c.name} ({c.creditUnit} units): {c.grade}
                    </li>
                ))}
            </ul>
        </div>
    );
}

 // --- AI Study Tips Modal Component ---
        function StudyTipsModal({ tips, onClose }) {
            if (!tips) return null;
            return (
                <div className="modal-overlay">
                    <div className="modal-content">
                <h3>Personalized Study Tips from AI</h3>
                <p className="description-text">Here are some tips based on your academic performance:</p>
                <div className="study-tips-content" dangerouslySetInnerHTML={{ __html: tips.replace(/\n/g, '<br>') }}></div>
                <button onClick={onClose} className="modal-close-btn">Got It!</button>
            </div>
        </div>
    );
}
        // Ensure the modal close logic works
        {showStudyTipsModal && (
            <StudyTipsModal tips={aiStudyTips} onClose={() => setShowStudyTipsModal(false)} />
        )}

// --- AI Chatbot Component ---
function AIChatbot({ semesters, overallCgpa, totalCreditUnitsAccumulated }) {
    const [isOpen, setIsOpen] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showWelcome, setShowWelcome] = useState(true);
    const chatMessagesRef = useRef(null); // Ref for scrolling chat

    // Scroll to bottom of chat messages when history updates
    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [chatHistory]);

    // Welcome message animation on load
    useEffect(() => {
        const welcomeTimer = setTimeout(() => {
            setShowWelcome(false);
        }, 5000); // Show welcome for 5 seconds

        return () => clearTimeout(welcomeTimer);
    }, []);

    const handleSendMessage = async () => {
        const userMessage = chatInput.trim();
        if (!userMessage) return;

        const newChatHistory = [...chatHistory, { role: "user", parts: [{ text: userMessage }] }];
        setChatHistory(newChatHistory);
        setChatInput('');
        setIsLoading(true);

        // Prepare academic context for the AI
        const academicContext = `
            My current CGPA is ${overallCgpa} based on ${totalCreditUnitsAccumulated} credit units.
            Here's a summary of my past semesters and courses:
            ${JSON.stringify(semesters, null, 2)}
        `;

        const prompt = `Given my academic data:\n${academicContext}\n\nMy question is: ${userMessage}\n\nProvide relevant study tips, answer questions about my grades, or offer general academic advice. Keep it concise and helpful.`;

        const aiResponse = await getAIGeneratedResponse(prompt, newChatHistory);
        setChatHistory(prev => [...prev, { role: "model", parts: [{ text: aiResponse }] }]);
        setIsLoading(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !isLoading) {
            handleSendMessage();
        }
    };

    return (
        <div className="ai-chatbot-container">
            <button
                className={`ai-chatbot-toggle-btn ${showWelcome ? 'welcome-active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                {showWelcome && !isOpen ? (
                    <span className="welcome-message">
                        Hi, I'm your study help AI. Here to answer any questions or concerns you may have. 😊
                    </span>
                ) : null}
                <span className="ai-icon">💬</span>
            </button>

            {isOpen && (
                <div className="ai-chat-window">
                    <div className="chat-header">
                        <h3>Study Help AI</h3>
                        <button onClick={() => setIsOpen(false)} className="close-chat-btn">X</button>
                    </div>
                    <div className="chat-messages" ref={chatMessagesRef}>
                        {chatHistory.length === 0 ? (
                            <div className="chat-welcome">
                                <p>Hello! How can I assist you with your studies or CGPA today?</p>
                            </div>
                        ) : (
                            chatHistory.map((msg, index) => (
                                <div key={index} className={`chat-message ${msg.role}`}>
                                    <span className="message-role">{msg.role === 'user' ? 'You:' : 'AI:'}</span>
                                    <p>{msg.parts[0].text}</p>
                                </div>
                            ))
                        )}
                        {isLoading && <div className="chat-message model loading">AI is thinking...</div>}
                    </div>
                    <div className="chat-input-area">
                        <input
                            type="text"
                            placeholder="Ask me anything about your studies..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                        />
                        <button onClick={handleSendMessage} disabled={isLoading}>Send</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Main App Component ---
function App() {
    const [semesters, setSemesters] = useState([]);
    const [selectedLevel, setSelectedLevel] = useState('100 Level');
    const [selectedSemesterType, setSelectedSemesterType] = useState('First Semester');
    const [currentSemesterCourses, setCurrentSemesterCourses] = useState([
        { id: generateId(), name: '', creditUnit: 1, grade: '' }
    ]);
    const [overallCgpa, setOverallCgpa] = useState('0.00');
    const [totalCreditUnitsAccumulated, setTotalCreditUnitsAccumulated] = useState(0);

    const [targetOverallCgpaInput, setTargetOverallCgpaInput] = useState('');
    const [numberOfProjectedCoursesInput, setNumberOfProjectedCoursesInput] = useState('');
    const [projectedCoursesResults, setProjectedCoursesResults] = useState([]);

    const [showStudyTipsModal, setShowStudyTipsModal] = useState(false);
    const [aiStudyTips, setAiStudyTips] = useState('');
    const [isGeneratingTips, setIsGeneratingTips] = useState(false);

    // Course dropdown integration in App() component:
    const availableCourses = courseDB[selectedLevel]?.[selectedSemesterType] || [];
    const handleAddFromDropdown = (e) => {
    const [name, creditUnit] = e.target.value.split("|");
    if (!name) return;
    setCurrentSemesterCourses([...currentSemesterCourses, {
        id: generateId(),
        name,
        creditUnit: parseInt(creditUnit),
        grade: ''
    }]);
    };

    // Ref to store the stringified version of semesters that was last used to generate tips
    const lastProcessedSemestersRef = useRef(null);


    // --- Data Persistence (Local Storage) ---
    // Load data from localStorage on component mount
    useEffect(() => {
        try {
            const storedSemesters = localStorage.getItem('gradeProNGData');
            if (storedSemesters) {
                const parsedSemesters = JSON.parse(storedSemesters);
                setSemesters(parsedSemesters);
            }
        } catch (error) {
            console.error("Error loading data from local storage:", error);
        }
    }, []);

    // Save data to localStorage whenever 'semesters' state changes
    useEffect(() => {
        try {
            localStorage.setItem('gradeProNGData', JSON.stringify(semesters));
        } catch (error) {
            console.error("Error saving data to local storage:", error);
        }
    }, [semesters]);

    // --- AI Study Tips Generation ---
    // This function only generates the tips, it no longer handles modal visibility
    const generateStudyTipsBasedOnPerformance = async (currentSemesters) => {
        setIsGeneratingTips(true);
        const { strengths, weaknesses } = analyzeAcademicPerformance(currentSemesters);

        let prompt = `I am a university student with a current CGPA of ${overallCgpa} on a 5.0 scale.`;

        if (strengths.length > 0) {
            prompt += ` My strengths appear to be in courses like: ${strengths.join(', ')}.`;
        }
        if (weaknesses.length > 0) {
            prompt += ` My weaknesses appear to be in courses like: ${weaknesses.join(', ')}.`;
        }

        if (parseFloat(overallCgpa) >= 4.0) {
            prompt += ` My CGPA is high, suggesting good performance. Provide extensive study tips to maintain this high CGPA, excel further, and perhaps explore advanced topics or research.`;
        } else if (parseFloat(overallCgpa) >= 2.5) {
            prompt += ` My CGPA is moderate. Provide extensive study tips to improve my grades, specifically focusing on how to turn weaknesses into strengths and general strategies for academic improvement.`;
        } else {
            prompt += ` My CGPA is low. Provide extensive, actionable study tips to significantly improve my performance, focusing on fundamental study habits, time management, and specific strategies for improving in weak areas.`;
        }

        prompt += ` Please also suggest how to improve in the identified weak areas. Format the tips clearly with bullet points or numbered lists.`;

        const tips = await getAIGeneratedResponse(prompt);
        setAiStudyTips(tips);
        setIsGeneratingTips(false);
    };

    // Effect to update overall CGPA, total credit units, and trigger AI tip generation
    useEffect(() => {
        const { cgpa, totalCreditUnits } = calculateCGPA(semesters);
        setOverallCgpa(cgpa);
        setTotalCreditUnitsAccumulated(totalCreditUnits);

        const currentSemestersString = JSON.stringify(semesters);

        // Trigger AI study tips generation if semesters data has changed and there's data
        // and we're not currently generating tips
        if (semesters.length > 0 && currentSemestersString !== lastProcessedSemestersRef.current && !isGeneratingTips) {
            generateStudyTipsBasedOnPerformance(semesters);
            lastProcessedSemestersRef.current = currentSemestersString; // Store the state that triggered this generation
        } else if (semesters.length === 0 && aiStudyTips) {
            // If all semesters are cleared, hide and clear tips
            setShowStudyTipsModal(false);
            setAiStudyTips('');
            lastProcessedSemestersRef.current = null; // Reset ref if data is cleared
        }
    }, [semesters, isGeneratingTips, overallCgpa, aiStudyTips]); // Added aiStudyTips to dependencies to ensure effect runs if it clears.

    // Effect to show the modal *only* when new AI tips are ready and generation is complete
    useEffect(() => {
        if (aiStudyTips && !isGeneratingTips) {
            setShowStudyTipsModal(true);
        }
    }, [aiStudyTips, isGeneratingTips]);


    // --- Handlers for current semester input ---
    const handleAddCourseRow = () => {
        setCurrentSemesterCourses([...currentSemesterCourses, { id: generateId(), name: '', creditUnit: 1, grade: '' }]);
    };

    const handleRemoveCourseRow = (id) => {
        setCurrentSemesterCourses(currentSemesterCourses.filter(course => course.id !== id));
    };

    const handleCourseChange = (id, field, value) => {
        setCurrentSemesterCourses(currentSemesterCourses.map(course =>
            course.id === id ? { ...course, [field]: value } : course
        ));
    };

    const handleAddSemester = () => {
        const semesterName = `${selectedLevel} - ${selectedSemesterType}`;

        const validCourses = currentSemesterCourses.filter(
            c => c.name.trim() && c.creditUnit > 0 && c.grade
        );

        if (validCourses.length === 0) {
            alert("Please add at least one valid course for the semester.");
            return;
        }

        const hasInvalidPartialRow = currentSemesterCourses.some(c =>
            (c.name.trim() || c.creditUnit > 0 || c.grade) && // Has some data
            (!c.name.trim() || isNaN(c.creditUnit) || c.creditUnit <= 0 || !c.grade) // But is incomplete/invalid
        );

        if (hasInvalidPartialRow) {
            alert("Please ensure all course details are correctly filled or remove incomplete rows.");
            return;
        }

        const newSemester = {
            id: generateId(),
            semesterName: semesterName,
            courses: validCourses
        };

        setSemesters(prevSemesters => [...prevSemesters, newSemester]);

        setCurrentSemesterCourses([{ id: generateId(), name: '', creditUnit: 1, grade: '' }]);
    };

    // --- Semester Management (Delete) ---
    const handleDeleteSemester = (idToDelete) => {
        if (window.confirm("Are you sure you want to delete this semester? This action cannot be undone.")) {
            setSemesters(prevSemesters => prevSemesters.filter(sem => sem.id !== idToDelete));
        }
    };

    // --- Clear All Data ---
    const handleClearAllData = () => {
        if (window.confirm("Are you sure you want to clear ALL your academic data? This action cannot be undone.")) {
            setSemesters([]);
            setTargetOverallCgpaInput('');
            setNumberOfProjectedCoursesInput('');
            setProjectedCoursesResults([]);
            setAiStudyTips(''); // Clear AI tips as well
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
                            <option value="500 Level">500 Level</option>
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
                            id="generatedSemesterName"
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
                    <button id="addCourseBtn" onClick={handleAddCourseRow}>Add Another Course</button>
                    <button id="addSemesterBtn" onClick={handleAddSemester}>Calculate Semester & Add</button>
                </section>

                <section className="results">
                    <h2>Your Academic Summary</h2>
                    <div id="semesterResults">
                        {semesters.length === 0 ? (
                            <p className="no-data-message">No semesters added yet. Start by adding your first semester!</p>
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
                    </div>
                     <button className="clear-all-data-btn" onClick={handleClearAllData}>Clear All My Data</button>
                </section>


                <section className="target-cgpa-calculator">
                    <h2>Projected CGPA for Next Semester/Level</h2>
                    <p className="description-text">
                        See what average grade you need in your upcoming semester/level to achieve a target overall CGPA!
                    </p>
                    <div className="input-group">
                        <label htmlFor="targetOverallCgpa">Target Overall CGPA After Next Semester/Level:</label>
                        <input
                            type="number"
                            id="targetOverallCgpa"
                            placeholder="e.g., 4.50"
                            min="0.00"
                            max="5.00"
                            step="0.01"
                            value={targetOverallCgpaInput}
                            onChange={(e) => setTargetOverallCgpaInput(e.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="numberOfProjectedCourses">Number of Courses in Next Semester/Level:</label>
                        <input
                            type="number"
                            id="numberOfProjectedCourses"
                            placeholder="e.g., 6"
                            min="1"
                            value={numberOfProjectedCoursesInput}
                            onChange={(e) => setNumberOfProjectedCoursesInput(e.target.value)}
                        />
                    </div>
                    <button id="calculateProjectedBtn" onClick={handleCalculateProjectedCgpa}>
                        Calculate Projected Grades
                    </button>
                    <div className="prediction-result">
                        {projectedCoursesResults.length === 0 ? (
                            <p>Enter details above to see projected grades.</p>
                        ) : projectedCoursesResults[0].name === 'Calculation Error' ? (
                            <p className="error-message">Error in calculation. Please check inputs.</p>
                        ) : projectedCoursesResults[0].name === 'Unrealistic Target' ? (
                            <p className="error-message">Target is {projectedCoursesResults[0].requiredGrade}. Consider adjusting your desired CGPA or number of courses.</p>
                        ) : (
                            <>
                                <p>To achieve your target, you need an average SGPA of <span className="highlight">{calculateSGPA(projectedCoursesResults.map(pc => ({creditUnit: pc.creditUnit, grade: getLetterGrade(getGradePoint(pc.requiredGrade))})))}</span> in the next semester/level. This translates to:</p>
                                <ul>
                                    {projectedCoursesResults.map((course, index) => (
                                        <li key={index}>
                                            <span className="highlight">{course.name}</span> ({course.creditUnit} units): <span className="highlight">{course.requiredGrade}</span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                </section>

                {/* Render PDF download button */}
                <button onClick={handleExportPdf}>Download PDF</button>

                {/* Ensure the modal close logic works */}
                {showStudyTipsModal && (
                    <StudyTipsModal tips={aiStudyTips} onClose={() => setShowStudyTipsModal(false)} />
                )}
            </main>

            <footer>
                <p>&copy; 2025 GradePro NG. All rights reserved.</p>
            </footer>

            {/* AI Chatbot */}
            <AIChatbot
                semesters={semesters}
                overallCgpa={overallCgpa}
                totalCreditUnitsAccumulated={totalCreditUnitsAccumulated}
            />
        </div>
    );
}

    // --- Handlers for Projected CGPA for Next Semester/Level ---
    const handleCalculateProjectedCgpa = () => {
        const currentCgpaNum = parseFloat(overallCgpa);
        const desiredOverallCgpaNum = parseFloat(targetOverallCgpaInput);
        const numProjectedCourses = parseInt(numberOfProjectedCoursesInput);

        if (isNaN(desiredOverallCgpaNum) || desiredOverallCgpaNum < 0 || desiredOverallCgpaNum > 5.0) {
            alert("Please enter a valid target overall CGPA between 0.00 and 5.00.");
            setProjectedCoursesResults([]);
            return;
        }
        if (isNaN(numProjectedCourses) || numProjectedCourses <= 0) {
            alert("Please enter a valid number of courses for the next semester/level (greater than 0).");
            setProjectedCoursesResults([]);
            return;
        }

        const avgCreditUnitPerCourse = calculateAverageCreditUnitPerCourse(semesters);
        let totalNextSemesterCreditUnits = 0;
        let allocatedUnits = [];

        if (avgCreditUnitPerCourse > 0) {
            const baseUnit = Math.floor(avgCreditUnitPerCourse);
            const remainder = avgCreditUnitPerCourse - baseUnit;
            const numCoursesWithExtraUnit = Math.round(remainder * numProjectedCourses);

            for (let i = 0; i < numProjectedCourses; i++) {
                let unit = baseUnit;
                if (i < numCoursesWithExtraUnit) {
                    unit++;
                }
                unit = Math.max(1, Math.min(5, unit));
                allocatedUnits.push(unit);
                totalNextSemesterCreditUnits += unit;
            }
        } else {
            for (let i = 0; i < numProjectedCourses; i++) {
                allocatedUnits.push(3);
                totalNextSemesterCreditUnits += 3;
            }
        }

        const requiredSGPA = calculateRequiredSGPANextSemester(
            currentCgpaNum,
            totalCreditUnitsAccumulated,
            desiredOverallCgpaNum,
            totalNextSemesterCreditUnits
        );

        let newProjectedCourses = [];
        if (isNaN(requiredSGPA)) {
            setProjectedCoursesResults([{ name: 'Calculation Error', creditUnit: 0, requiredGrade: 'Error' }]);
        } else if (requiredSGPA > 5.0) {
            setProjectedCoursesResults([{ name: 'Unrealistic Target', creditUnit: 0, requiredGrade: 'Too High' }]);
        } else if (requiredSGPA < 0) {
             setProjectedCoursesResults([{ name: 'Unrealistic Target', creditUnit: 0, requiredGrade: 'Too Low' }]);
        }
        else {
            for (let i = 0; i < numProjectedCourses; i++) {
                newProjectedCourses.push({
                    name: `Projected Course ${i + 1}`,
                    creditUnit: allocatedUnits[i] || 3,
                    requiredGrade: getLetterGrade(requiredSGPA)
                });
            }
            setProjectedCoursesResults(newProjectedCourses);
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
                            <option value="500 Level">500 Level</option>
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
                            id="generatedSemesterName"
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
                    <button id="addCourseBtn" onClick={handleAddCourseRow}>Add Another Course</button>
                    <button id="addSemesterBtn" onClick={handleAddSemester}>Calculate Semester & Add</button>
                </section>

                <section className="results">
                    <h2>Your Academic Summary</h2>
                    <div id="semesterResults">
                        {semesters.length === 0 ? (
                            <p className="no-data-message">No semesters added yet. Start by adding your first semester!</p>
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
                    </div>
                     <button className="clear-all-data-btn" onClick={handleClearAllData}>Clear All My Data</button>
                </section>


                <section className="target-cgpa-calculator">
                    <h2>Projected CGPA for Next Semester/Level</h2>
                    <p className="description-text">
                        See what average grade you need in your upcoming semester/level to achieve a target overall CGPA!
                    </p>
                    <div className="input-group">
                        <label htmlFor="targetOverallCgpa">Target Overall CGPA After Next Semester/Level:</label>
                        <input
                            type="number"
                            id="targetOverallCgpa"
                            placeholder="e.g., 4.50"
                            min="0.00"
                            max="5.00"
                            step="0.01"
                            value={targetOverallCgpaInput}
                            onChange={(e) => setTargetOverallCgpaInput(e.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="numberOfProjectedCourses">Number of Courses in Next Semester/Level:</label>
                        <input
                            type="number"
                            id="numberOfProjectedCourses"
                            placeholder="e.g., 6"
                            min="1"
                            value={numberOfProjectedCoursesInput}
                            onChange={(e) => setNumberOfProjectedCoursesInput(e.target.value)}
                        />
                    </div>
                    <button id="calculateProjectedBtn" onClick={handleCalculateProjectedCgpa}>
                        Calculate Projected Grades
                    </button>
                    <div className="prediction-result">
                        {projectedCoursesResults.length === 0 ? (
                            <p>Enter details above to see projected grades.</p>
                        ) : projectedCoursesResults[0].name === 'Calculation Error' ? (
                            <p className="error-message">Error in calculation. Please check inputs.</p>
                        ) : projectedCoursesResults[0].name === 'Unrealistic Target' ? (
                            <p className="error-message">Target is {projectedCoursesResults[0].requiredGrade}. Consider adjusting your desired CGPA or number of courses.</p>
                        ) : (
                            <>
                                <p>To achieve your target, you need an average SGPA of <span className="highlight">{calculateSGPA(projectedCoursesResults.map(pc => ({creditUnit: pc.creditUnit, grade: getLetterGrade(getGradePoint(pc.requiredGrade))})))}</span> in the next semester/level. This translates to:</p>
                                <ul>
                                    {projectedCoursesResults.map((course, index) => (
                                        <li key={index}>
                                            <span className="highlight">{course.name}</span> ({course.creditUnit} units): <span className="highlight">{course.requiredGrade}</span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                </section>
            </main>

            <footer>
                <p>&copy; 2025 GradePro NG. All rights reserved.</p>
            </footer>

            {/* AI Chatbot */}
            <AIChatbot
                semesters={semesters}
                overallCgpa={overallCgpa}
                totalCreditUnitsAccumulated={totalCreditUnitsAccumulated}
            />
        </div>
    );

// Mount the React app to the DOM
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);