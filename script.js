// Data and state variables (must be initialized globally or passed)
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
const mockDoctors = [
    { id: 1, firstName: 'Aisha', lastName: 'Khan', specialty: 'Cardiology', email: 'aisha.khan@eclipse.com' },
    { id: 2, firstName: 'Rajesh', lastName: 'Sharma', specialty: 'General Practice', email: 'rajesh.sharma@eclipse.com' },
    { id: 3, firstName: 'Priya', lastName: 'Verma', specialty: 'Diabetology', email: 'priya.verma@eclipse.com' },
];
let appointmentRequests = JSON.parse(localStorage.getItem('appointmentRequests')) || [];

function saveAppointmentRequests() {
    localStorage.setItem('appointmentRequests', JSON.stringify(appointmentRequests));
}

function saveUser(user) {
    const users = JSON.parse(localStorage.getItem('healthcareUsers')) || [];
    const index = users.findIndex(u => u.email === user.email);
    if (index !== -1) {
        users[index] = user;
    } else {
        users.push(user);
    }
    localStorage.setItem('healthcareUsers', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(user));
    currentUser = user;
}

function calculateBMI(weight, height) {
    const heightMeters = height / 100;
    return weight / (heightMeters * heightMeters);
}

// Utility Functions
// ----------------------------------------------------------------------

function updateHeader() {
    const authButtons = document.getElementById('auth-buttons');
    const userInfo = document.getElementById('user-info');
    const welcomeMessage = document.getElementById('welcome-message');
    
    if (authButtons && userInfo && welcomeMessage) {
        if (currentUser) {
            authButtons.classList.add('hidden');
            userInfo.classList.remove('hidden');
            userInfo.classList.add('flex');
            welcomeMessage.textContent = `Welcome, ${currentUser.firstName}!`;
        } else {
            authButtons.classList.remove('hidden');
            userInfo.classList.add('hidden');
            userInfo.classList.remove('flex');
        }
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    window.location.href = 'frontpage.html';
}

function redirectToDashboard() {
    if (!currentUser) {
        // Stay on landing page/login if not logged in
        return;
    } else if (currentUser.role === 'patient') {
        window.location.href = 'patient.html';
    } else if (currentUser.role === 'doctor') {
        window.location.href = 'doctor.html';
    } else {
        window.location.href = 'frontpage.html';
    }
}

// HTML Generation Functions (for Dashboards)
// ----------------------------------------------------------------------

function formatHealthRecord(record) {
    if (!record) return '<p class="text-gray-500 dark:text-gray-400">No health records submitted yet.</p>';
    
    return `
        <div class="space-y-4">
            <div><strong class="text-blue-600 dark:text-blue-400">Vital Signs:</strong></div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <p><strong>Weight:</strong> ${record.weight} kg</p>
                <p><strong>Height:</strong> ${record.height} cm</p>
                <p><strong>Gender:</strong> ${record.gender}</p>
                <p><strong>BP (Systolic):</strong> ${record.bpSystolic} mmHg</p>
                <p><strong>BP (Diastolic):</strong> ${record.bpDiastolic} mmHg</p>
                <p><strong>Heart Rate:</strong> ${record.heartRate} bpm</p>
                <p><strong>Blood Sugar:</strong> ${record.bloodSugar} mg/dL</p>
            </div>
            <div><strong class="text-blue-600 dark:text-blue-400">Lifestyle:</strong></div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <p><strong>Sleep:</strong> ${record.sleepDuration} hrs</p>
                <p><strong>Exercise:</strong> ${record.exerciseMinutes} mins/day</p>
                <p><strong>Water:</strong> ${record.waterIntake} litres</p>
                <p><strong>Stress:</strong> ${record.stressLevel}/10</p>
                <p class="sm:col-span-3"><strong>Alcohol/Smoking:</strong> ${record.alcoholSmoking.replace('_', ' ')}</p>
            </div>
            <div><strong class="text-blue-600 dark:text-blue-400">Symptoms & Notes:</strong></div>
            <p class="text-sm"><strong>Symptoms:</strong> ${record.symptoms || 'None reported'}</p>
            <p class="text-sm"><strong>Notes:</strong> ${record.additionalNotes || 'N/A'}</p>
        </div>
    `;
}

function getPatientAppointmentsHtml(patientEmail) {
    const requests = appointmentRequests.filter(req => req.patientEmail === patientEmail);
    if (requests.length === 0) {
        return '<p class="text-gray-500 dark:text-gray-400">You have no pending or confirmed appointments.</p>';
    }
    
    return `<ul class="space-y-3">
        ${requests.map(req => {
            const doctor = mockDoctors.find(d => d.email === req.doctorEmail);
            const doctorName = doctor ? `Dr. ${doctor.lastName} (${doctor.specialty})` : req.doctorEmail;
            const statusColor = req.status === 'Pending' ? 'text-yellow-500' : 'text-green-500';
            return `<li class="text-sm border-b border-gray-200 dark:border-gray-700 pb-2">
                Appointment with <strong>${doctorName}</strong>: <span class="${statusColor}">${req.status}</span>
            </li>`;
        }).join('')}
    </ul>`;
}

function getDoctorAppointmentRequestsHtml(doctorEmail) {
    const requests = appointmentRequests.filter(req => req.doctorEmail === doctorEmail && req.status === 'Pending');
    
    if (requests.length === 0) {
         return '<p class="text-gray-500 dark:text-gray-400">You have no new appointment requests.</p>';
    }
    
    const allUsers = JSON.parse(localStorage.getItem('healthcareUsers')) || [];
    
    return `<ul class="space-y-4">
        ${requests.map(req => {
            const patientUser = allUsers.find(u => u.email === req.patientEmail);
            const patientName = patientUser ? `${patientUser.firstName} ${patientUser.lastName}` : req.patientEmail;
            const patientRecord = patientUser?.healthRecord 
                ? `(BMI: ${calculateBMI(patientUser.healthRecord.weight, patientUser.healthRecord.height).toFixed(1)}, BP: ${patientUser.healthRecord.bpSystolic}/${patientUser.healthRecord.bpDiastolic})` 
                : '';
            
            return `<li class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg flex justify-between items-center" data-patient-email="${req.patientEmail}">
                <div>
                    <p class="font-semibold text-lg">${patientName}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Requesting Consultation ${patientRecord}</p>
                </div>
                <div>
                    <button class="accept-btn bg-green-500 hover:bg-green-600 text-white text-sm py-1 px-3 rounded-md mr-2" data-patient="${req.patientEmail}">Accept</button>
                    <button class="reject-btn bg-red-500 hover:bg-red-600 text-white text-sm py-1 px-3 rounded-md" data-patient="${req.patientEmail}">Reject</button>
                </div>
            </li>`;
        }).join('')}
    </ul>`;
}

function generateHealthResultsHtml(record) {
    // This function is complex, so only the setup is shown. It performs BMI/BP/Sugar checks and suggests doctors/meds.
    // The full content is copied from the original JS logic.
    const warnings = [];
    const medicineSuggestions = [];
    let doctorSpecialty = 'General Practice';
    
    // BMI Calculation and Warning
    const bmi = calculateBMI(record.weight, record.height);
    if (bmi > 30) {
        warnings.push('Severe Obesity: High risk of heart disease and diabetes. Consult a specialist.');
        medicineSuggestions.push('Lifestyle modification is the primary treatment. No immediate medication suggested without a doctor’s diagnosis.');
        doctorSpecialty = 'Cardiology';
    } else if (bmi > 25) {
        warnings.push('Overweight: Increased risk of hypertension and high cholesterol.');
        medicineSuggestions.push('Focus on diet and exercise. Consider supplements like Omega-3 for heart health (consult doctor).');
    }
    
    // Blood Pressure Warning
    if (record.bpSystolic >= 140 || record.bpDiastolic >= 90) {
        warnings.push('Hypertension (High Blood Pressure): Your blood pressure is high. This needs immediate medical attention.');
        medicineSuggestions.push('Initial suggestion: Lifestyle changes. Possible medications (e.g., ACE inhibitors or Beta-blockers) require a doctor’s prescription.');
        doctorSpecialty = 'Cardiology';
    } else if (record.bpSystolic >= 120 || record.bpDiastolic >= 80) {
        warnings.push('Elevated Blood Pressure: Close monitoring and lifestyle changes are recommended.');
    }
    
    // Blood Sugar Warning
    if (record.bloodSugar > 125) {
        warnings.push('High Blood Sugar: Your fasting blood sugar is elevated (possible diabetes). A formal lab test is necessary.');
        medicineSuggestions.push('Metformin (prescription only) is common for Type 2 Diabetes. Immediately start dietary control and increased physical activity.');
        doctorSpecialty = 'Diabetology';
    }
    
    // Lifestyle Warnings
    if (record.sleepDuration < 6) {
        warnings.push('Chronic Sleep Deprivation: This can severely impact mood, immunity, and concentration.');
    }
    if (record.stressLevel > 7) {
        warnings.push('High Stress Level: High stress can exacerbate other conditions like hypertension.');
    }
    if (['regular_alcohol', 'smoker', 'both'].includes(record.alcoholSmoking)) {
        warnings.push('High-Risk Lifestyle: Alcohol and/or smoking significantly increases cancer and cardiovascular disease risk.');
    }
    
    // Symptom-Based Suggestions
    if (record.symptoms && record.symptoms.toLowerCase().includes('headache')) {
         medicineSuggestions.push('For general headache relief: OTC Pain relievers like Ibuprofen or Paracetamol (Tylenol).');
    }
    if (record.symptoms && record.symptoms.toLowerCase().includes('fever')) {
         medicineSuggestions.push('For mild fever: Paracetamol (Acetaminophen) for temperature control.');
    }
    if (record.symptoms && record.symptoms.toLowerCase().includes('fatigue') && record.sleepDuration > 6) {
        medicineSuggestions.push('Persistent fatigue (even with sufficient sleep): May require blood tests to check for vitamin deficiencies (e.g., Vitamin D, B12).');
        doctorSpecialty = 'General Practice';
    }
    
    const warningHtml = warnings.length > 0 ? 
        `<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-4">
            <p class="font-bold">⚠️ Health Warnings & AI Insights</p>
            <ul class="list-disc list-inside mt-2 space-y-1 text-sm">${warnings.map(w => `<li>${w}</li>`).join('')}</ul>
        </div>` : 
        `<div class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-lg mb-4">
            <p class="font-bold">✅ Health Summary</p>
            <p class="text-sm mt-2">Your vital signs and lifestyle factors indicate a low immediate risk. Keep up the healthy habits!</p>
        </div>`;
        
    const medicineHtml = medicineSuggestions.length > 0 ?
        `<div class="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded-lg mb-4">
            <p class="font-bold">💊 Possible Medicine Suggestions (Consult a Doctor!)</p>
            <ul class="list-disc list-inside mt-2 space-y-1 text-sm">${medicineSuggestions.map(m => `<li>${m}</li>`).join('')}</ul>
        </div>` : '';
        
    const doctorListHtml = generateDoctorListHtml(doctorSpecialty);

    return `
        <div class="space-y-4">
            <h3 class="text-2xl font-semibold text-blue-600 dark:text-blue-400">Health Analysis Results</h3>
            ${warningHtml}
            ${medicineHtml}
            ${doctorListHtml}
        </div>
    `;
}

function generateDoctorListHtml(suggestedSpecialty) {
    const filteredDoctors = mockDoctors.filter(d => d.specialty === suggestedSpecialty);
    const allDoctors = mockDoctors;
    const doctors = filteredDoctors.length > 0 ? filteredDoctors : allDoctors;
    const suggestionText = filteredDoctors.length > 0 ? `Based on your results, we recommend a **${suggestedSpecialty}** specialist:` : 'General list of available doctors:';
    
    return `
        <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <h4 class="text-xl font-semibold mb-3">🧑‍⚕️ Doctor Recommendations</h4>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">${suggestionText}</p>
            <ul class="space-y-3">
                ${doctors.map(doctor => {
                    const hasPendingRequest = appointmentRequests.some(req => 
                        currentUser && req.patientEmail === currentUser.email && 
                        req.doctorEmail === doctor.email &&
                        req.status === 'Pending'
                    );
                    
                    const button = hasPendingRequest 
                        ? `<span class="text-sm text-yellow-500 font-medium">Request Pending</span>` 
                        : `<button class="request-appointment-btn bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-3 rounded-md" data-doctor-email="${doctor.email}">Request Appointment</button>`;
                        
                    return `<li class="flex justify-between items-center p-3 border-b dark:border-gray-700 last:border-b-0">
                        <div>
                            <p class="font-semibold">Dr. ${doctor.lastName}</p>
                            <p class="text-sm text-blue-600 dark:text-blue-400">${doctor.specialty}</p>
                        </div>
                        ${currentUser && currentUser.role === 'patient' ? button : ''}
                    </li>`;
                }).join('')}
            </ul>
        </div>
    `;
}


// Form Submission Handlers (used in login/register/patient pages)
// ----------------------------------------------------------------------

function handleLogin(e) {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const users = JSON.parse(localStorage.getItem('healthcareUsers')) || [];
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        currentUser = user;
        redirectToDashboard();
    } else {
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = 'Invalid email or password.';
        errorEl.classList.remove('hidden');
    }
}

function handleRegister(e) {
    e.preventDefault();
    const users = JSON.parse(localStorage.getItem('healthcareUsers')) || [];
    const email = e.target.email.value;
    const errorEl = document.getElementById('register-error');

    if (users.find(u => u.email === email)) {
        errorEl.textContent = 'A user with this email already exists.';
        errorEl.classList.remove('hidden');
        return;
    }

    const newUser = {
        firstName: e.target.firstName.value,
        lastName: e.target.lastName.value,
        dob: e.target.dob.value,
        email: email,
        password: e.target.password.value,
        role: e.target.role.value,
        healthRecord: null 
    };
    
    saveUser(newUser); 
    
    alert('Registration successful! Please log in.');
    window.location.href = 'login.html';
}

function handleHealthRecordSubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    const record = {
        weight: parseFloat(form.weight.value),
        height: parseInt(form.height.value),
        gender: form.gender.value,
        bpSystolic: parseInt(form.bpSystolic.value),
        bpDiastolic: parseInt(form.bpDiastolic.value),
        heartRate: parseInt(form.heartRate.value),
        bloodSugar: parseInt(form.bloodSugar.value),
        sleepDuration: parseFloat(form.sleepDuration.value),
        exerciseMinutes: parseInt(form.exerciseMinutes.value),
        waterIntake: parseFloat(form.waterIntake.value),
        stressLevel: parseInt(form.stressLevel.value),
        alcoholSmoking: form.alcoholSmoking.value,
        symptoms: form.symptoms.value.trim(),
        additionalNotes: form.additionalNotes.value.trim(),
        timestamp: new Date().toISOString()
    };
    
    currentUser.healthRecord = record;
    saveUser(currentUser);
    
    // Redirect or re-render (for simplicity, reloads the patient page)
    window.location.reload(); 
    alert('Health record submitted successfully! Review your analysis.');
}

function handleRequestAppointment(doctorEmail) {
    const existingRequest = appointmentRequests.find(req => 
        req.patientEmail === currentUser.email && 
        req.doctorEmail === doctorEmail &&
        req.status === 'Pending'
    );

    if (existingRequest) {
        alert('You already have a pending request with this doctor.');
        return;
    }
    
    appointmentRequests.push({
        patientEmail: currentUser.email,
        doctorEmail: doctorEmail,
        status: 'Pending',
        date: new Date().toLocaleString()
    });
    saveAppointmentRequests();
    window.location.reload(); 
    alert(`Appointment request sent to ${doctorEmail}!`);
}

function handleDoctorAction(patientEmail, action) {
    const requestIndex = appointmentRequests.findIndex(req => 
        req.patientEmail === patientEmail && 
        req.doctorEmail === currentUser.email &&
        req.status === 'Pending'
    );
    
    if (requestIndex !== -1) {
        appointmentRequests[requestIndex].status = action === 'accept' ? 'Confirmed' : 'Rejected';
        saveAppointmentRequests();
        window.location.reload(); 
        alert(`Appointment request from ${patientEmail} ${action}ed.`);
    }
}


// Main Initialization Function
// ----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', function() {
    // Theme Toggle Initialization
    const themeToggle = document.getElementById('checkbox');
    if(themeToggle) {
        if(localStorage.getItem('theme') === 'dark') {
            document.documentElement.classList.add('dark');
            themeToggle.checked = false;
        } else {
            document.documentElement.classList.remove('dark');
            themeToggle.checked = true;
        }
        themeToggle.addEventListener('change', function() {
            const isDark = !this.checked;
            document.documentElement.classList.toggle('dark', isDark);
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    // Header Update
    updateHeader();
    
    // Global Event Listener for actions
    document.body.addEventListener('click', e => {
        if (e.target.id === 'logout-btn') handleLogout();
        
        // Patient Appointment Request
        if (e.target.classList.contains('request-appointment-btn')) {
            handleRequestAppointment(e.target.dataset.doctorEmail);
        }
        
        // Doctor Dashboard Action
        if (e.target.classList.contains('accept-btn')) {
             handleDoctorAction(e.target.dataset.patient, 'accept');
        }
        if (e.target.classList.contains('reject-btn')) {
             handleDoctorAction(e.target.dataset.patient, 'reject');
        }
        
        // Update Record Button on Patient Page
        if (e.target.id === 'update-health-record-btn') {
             // Simply clear record and reload to show the form
             currentUser.healthRecord = null;
             saveUser(currentUser);
             window.location.reload();
        }
    });

    // Form Submission Listener (Forms are only on login/register/patient pages)
    document.body.addEventListener('submit', e => {
        if (e.target.id === 'login-form') handleLogin(e);
        if (e.target.id === 'register-form') handleRegister(e);
        if (e.target.id === 'health-record-form') handleHealthRecordSubmit(e);
    });
    
    // --- Loader Logic (Simplified for new files) ---
    const loader = document.getElementById('loader');
    const appContainer = document.getElementById('app-container');

    setTimeout(() => {
        if (loader) loader.classList.add('hidden');
        if (appContainer) {
            appContainer.style.visibility = 'visible';
            appContainer.style.opacity = '1';
        }
    }, 100); // Reduce loading time since content is static

    // Landing Page Specific Logic
    if (document.getElementById('landing-page-content')) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.classList.add('is-visible');
                    }, index * 150);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        const serviceCards = document.querySelectorAll('.service-card');
        serviceCards.forEach(card => observer.observe(card));
    }
});