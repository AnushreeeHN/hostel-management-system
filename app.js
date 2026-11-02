import express, { urlencoded, json, static as static_ } from 'express';
import { hash, compare } from 'bcrypt';
import { dirname, join } from 'path';
import connection from './db.js';
import { fileURLToPath } from 'url';
import cors from 'cors';

const app = express();
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(urlencoded({ extended: true }));
app.use(json());
app.use(static_('public'));

// ==========================
// 📄 STATIC PAGE ROUTES
// ==========================
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public/start.html'));
});

app.get('/student', (req, res) => {
    res.sendFile(join(__dirname, 'public/student.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(join(__dirname, 'public/admin.html'));
});

// ==========================
// 🔐 AUTH ROUTES
// ==========================

// Sign-up route
app.post('/sign-up', async (req, res) => {
    const { user_id, password, role } = req.body;

    if (!user_id || !password || !role) {
        return res.status(400).json({ message: 'Missing user_id, password, or role' });
    }

    try {
        const hashedPassword = await hash(password, 10);
        const query = 'INSERT INTO users (user_id, password, role) VALUES (?, ?, ?)';

        connection.query(query, [user_id.trim(), hashedPassword, role.trim().toLowerCase()], (err, result) => {
            if (err) {
                console.error("❌ Database error during sign-up:", err);
                return res.status(500).json({ message: 'Database error', error: err.message });
            }

            console.log("✅ Signed-up:", user_id, "as", role);

            if (role === "admin") {
                res.json({ success: true, redirect: "admin.html", user_id, role });
            } else {
                res.json({ success: true, redirect: "student.html", user_id, role });
            }
        });
    } catch (err) {
        console.error("❌ Internal error:", err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Alias for /register
app.post('/register', async (req, res) => {
    const { user_id, password, role } = req.body;

    if (!user_id || !password || !role) {
        return res.status(400).json({ success: false, message: 'Please provide User ID, Password, and Role.' });
    }

    try {
        const hashedPassword = await hash(password, 10);
        const query = 'INSERT INTO users (user_id, password, role) VALUES (?, ?, ?)';

        connection.query(query, [user_id.trim(), hashedPassword, role.trim().toLowerCase()], (err) => {
            if (err) {
                if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ success: false, message: 'User ID already exists.' });
                }
                return res.status(500).json({ success: false, message: 'Database error during registration.' });
            }
            res.json({ success: true, message: 'Registered successfully!', user_id, role });
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Login route (supports bcrypt hash and '123' bypass)
app.post('/login', (req, res) => {
    const { user_id, password } = req.body;

    if (!user_id || !password) {
        return res.status(400).json({ success: false, message: 'Please provide both User ID and Password.' });
    }

    const cleanUserId = String(user_id).trim();
    const cleanPassword = String(password).trim();

    connection.query('SELECT * FROM users WHERE TRIM(user_id) = ?', [cleanUserId], async (err, results) => {
        if (err) {
            console.error("❌ Login query error:", err);
            return res.status(500).json({ success: false, message: "Database query error" });
        }

        if (!results || results.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid user ID or password" });
        }

        const user = results[0];
        let isMatch = false;

        if (user.password === cleanPassword || cleanPassword === '123') {
            isMatch = true;
        } else if (user.password && user.password.startsWith('$2')) {
            try {
                isMatch = await compare(cleanPassword, user.password);
            } catch (bcryptErr) {
                isMatch = false;
            }
        }

        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Incorrect password" });
        }

        console.log(`✅ Login successful: ${user.user_id} (${user.role})`);
        res.json({
            success: true,
            user_id: user.user_id,
            role: user.role
        });
    });
});

// ==========================
// 🎓 STUDENT ROUTES
// ==========================

// Get student details by route param
app.get("/student/:user_id", (req, res) => {
    const { user_id } = req.params;
    const sql = `SELECT * FROM students WHERE student_id = ?`;

    connection.query(sql, [user_id], (err, result) => {
        if (err) {
            console.error("❌ Error fetching student details:", err);
            return res.status(500).json({ message: "Server error" });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: "Student not found" });
        }

        res.json(result[0]);
    });
});

// Get student details with room/hostel names (via query string)
app.get("/api/student", (req, res) => {
    const userId = req.query.user_id;

    if (!userId) {
        return res.status(400).json({ error: "Missing user_id" });
    }

    const sql = `
        SELECT s.*, h.hostel_name, r.room_type, r.rent
        FROM students s
        LEFT JOIN hostels h ON s.hostel_id = h.hostel_id
        LEFT JOIN rooms r ON s.room_id = r.room_id
        WHERE s.student_id = ?;
    `;

    connection.query(sql, [userId], (err, results) => {
        if (err) {
            console.error("❌ SQL Error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "No student record found" });
        }

        res.json(results[0]);
    });
});

// Save or update student details (supports both /saveStudentDetails and /student/save)
const handleSaveStudent = (req, res) => {
    const {
        roll_no,
        f_name,
        m_name,
        l_name,
        first_name,
        middle_name,
        last_name,
        department,
        course_year,
        student_phone,
        phone,
        student_email_Id,
        email,
        dob,
        gender,
        age,
        guardian_name,
        guardian_phone,
    } = req.body;

    const student_id = req.body.student_id || req.body.user_id;

    if (!student_id) {
        return res.status(400).json({ success: false, message: "Missing user_id or student_id" });
    }

    const resolved_f_name = f_name || first_name || null;
    const resolved_m_name = m_name || middle_name || null;
    const resolved_l_name = l_name || last_name || null;
    const resolved_phone = student_phone || phone || null;
    const resolved_email = student_email_Id || email || null;

    connection.query("SELECT * FROM users WHERE user_id = ?", [student_id], (err, userResults) => {
        if (err) {
            console.error("❌ Error checking user:", err);
            return res.status(500).json({ success: false, message: "Database error while checking user" });
        }

        if (userResults.length === 0) {
            return res.status(400).json({ success: false, message: "User not found in users table" });
        }

        const query = `
            INSERT INTO students (
                student_id, roll_no, f_name, m_name, l_name, department, course_year,
                student_phone, student_email_Id, dob, gender, age, guardian_name, guardian_phone
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                roll_no = VALUES(roll_no),
                f_name = VALUES(f_name),
                m_name = VALUES(m_name),
                l_name = VALUES(l_name),
                department = VALUES(department),
                course_year = VALUES(course_year),
                student_phone = VALUES(student_phone),
                student_email_Id = VALUES(student_email_Id),
                dob = VALUES(dob),
                gender = VALUES(gender),
                age = VALUES(age),
                guardian_name = VALUES(guardian_name),
                guardian_phone = VALUES(guardian_phone);
        `;

        connection.query(
            query,
            [
                student_id,
                roll_no || null,
                resolved_f_name,
                resolved_m_name,
                resolved_l_name,
                department || null,
                course_year || null,
                resolved_phone,
                resolved_email,
                dob || null,
                gender || null,
                age || null,
                guardian_name || null,
                guardian_phone || null
            ],
            (insertErr) => {
                if (insertErr) {
                    console.error("❌ Error inserting student:", insertErr);
                    return res.status(500).json({ success: false, message: "Error saving student details", error: insertErr.message });
                }
                console.log("✅ Student details saved successfully for:", student_id);
                res.status(200).json({ success: true, message: "Student details saved successfully" });
            }
        );
    });
};

app.post("/saveStudentDetails", handleSaveStudent);
app.post("/student/save", handleSaveStudent);

// Student warden contact
app.get("/student/:user_id/admin", (req, res) => {
    const userId = req.params.user_id;

    const query = `
        SELECT 
            a.admin_name, 
            a.admin_email, 
            a.admin_phone, 
            h.hostel_name
        FROM students s
        JOIN hostels h ON s.hostel_id = h.hostel_id
        JOIN admins a ON h.admin_id = a.admin_id
        WHERE s.student_id = ?;
    `;

    connection.query(query, [userId], (err, result) => {
        if (err) {
            console.error("❌ Error fetching admin details:", err);
            return res.status(500).json({ message: "Error fetching admin details", error: err });
        }

        if (result.length === 0) {
            return res.status(404).json({ message: "No admin found for this student" });
        }

        res.json(result[0]);
    });
});

// ==========================
// 🏢 HOSTEL & ADMIN ROUTES
// ==========================

// Global hostels endpoint (fixes manage2.html and admin panel fetch failures)
app.get(['/hostels', '/api/hostels'], (req, res) => {
    const query = `
        SELECT h.*, a.admin_name, a.admin_email, a.admin_phone 
        FROM hostels h
        LEFT JOIN admins a ON h.admin_id = a.admin_id;
    `;
    connection.query(query, (err, results) => {
        if (err) {
            console.error("❌ Error fetching hostels:", err);
            return res.status(500).json({ error: "Failed to fetch hostels" });
        }
        res.json(results);
    });
});

// Admin-specific hostels endpoint
app.get('/admin/hostels/:admin_id', (req, res) => {
    const adminId = req.params.admin_id;

    const query = `
        SELECT hostel_id, hostel_name, address, total_rooms 
        FROM hostels
        WHERE admin_id = ?;
    `;

    connection.query(query, [adminId], (err, results) => {
        if (err) {
            console.error("❌ DB Error:", err.sqlMessage || err.message);
            return res.status(500).json({ error: err.sqlMessage || err.message });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: "No hostels found for this admin." });
        }

        res.json(results);
    });
});

// Admin composite dashboard data
app.get("/admin/data/:admin_id", (req, res) => {
    const { admin_id } = req.params;

    const query = `
        SELECT 
            h.hostel_id, h.hostel_name,
            r.room_id, r.room_type, r.status,
            f.student_id, f.amount, f.status AS payment_status, f.payment_date
        FROM hostels h
        LEFT JOIN rooms r ON h.hostel_id = r.hostel_id
        LEFT JOIN students s ON s.hostel_id = h.hostel_id
        LEFT JOIN fee_payments f ON f.student_id = s.student_id
        WHERE h.admin_id = ?;
    `;

    connection.query(query, [admin_id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        const hostelsMap = {};

        results.forEach(row => {
            if (!hostelsMap[row.hostel_id]) {
                hostelsMap[row.hostel_id] = {
                    hostel_id: row.hostel_id,
                    hostel_name: row.hostel_name,
                    rooms: new Map(),
                    payments: new Map()
                };
            }

            if (row.room_id && !hostelsMap[row.hostel_id].rooms.has(row.room_id)) {
                hostelsMap[row.hostel_id].rooms.set(row.room_id, {
                    room_id: row.room_id,
                    room_type: row.room_type,
                    status: row.status
                });
            }

            if (row.student_id && row.amount !== null) {
                const key = `${row.student_id}-${row.amount}-${row.payment_date}`;
                if (!hostelsMap[row.hostel_id].payments.has(key)) {
                    hostelsMap[row.hostel_id].payments.set(key, {
                        student_id: row.student_id,
                        amount: row.amount,
                        status: row.payment_status,
                        payment_date: row.payment_date
                    });
                }
            }
        });

        const hostels = Object.values(hostelsMap).map(h => ({
            hostel_id: h.hostel_id,
            hostel_name: h.hostel_name,
            rooms: Array.from(h.rooms.values()),
            payments: Array.from(h.payments.values())
        }));

        res.json({ success: true, hostels });
    });
});

// Admin view all students under managed hostels
app.get("/admin/students", (req, res) => {
    const { admin_id } = req.query;

    let query = `
        SELECT 
            s.student_id, s.roll_no, s.f_name, s.m_name, s.l_name,
            s.student_email_Id, s.student_phone, s.department, s.course_year,
            s.guardian_name, s.guardian_phone,
            h.hostel_name, s.room_id,
            p.amount AS payment_amount, p.status AS payment_status
        FROM students s
        LEFT JOIN hostels h ON s.hostel_id = h.hostel_id
        LEFT JOIN fee_payments p ON s.student_id = p.student_id
    `;
    const params = [];

    if (admin_id) {
        query += ` WHERE h.admin_id = ?`;
        params.push(admin_id);
    }

    connection.query(query, params, (err, rows) => {
        if (err) {
            console.error("❌ Error fetching students:", err);
            return res.status(500).json({ message: "Server error", error: err.message });
        }
        res.json(rows);
    });
});

// All students general list endpoint
app.get(['/students', '/api/students'], (req, res) => {
    const query = `
        SELECT s.*, h.hostel_name, r.room_type, r.rent 
        FROM students s
        LEFT JOIN hostels h ON s.hostel_id = h.hostel_id
        LEFT JOIN rooms r ON s.room_id = r.room_id;
    `;
    connection.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: "Failed to fetch students" });
        }
        res.json(results);
    });
});

// Admin register student manually
app.post("/admin/register-student", async (req, res) => {
    const {
        user_id, password,
        roll_no, f_name, m_name, l_name, department, course_year,
        student_phone, student_email_Id, dob, gender, age,
        guardian_name, guardian_phone
    } = req.body;

    try {
        const hashedPassword = await hash(password, 10);

        connection.query(
            `INSERT INTO users (user_id, password, role) VALUES (?, ?, 'student')`,
            [user_id, hashedPassword],
            (userErr) => {
                if (userErr) {
                    return res.status(500).json({ message: "Error creating user credentials", error: userErr.message });
                }

                const studentSql = `
                    INSERT INTO students (
                        student_id, roll_no, f_name, m_name, l_name, department, course_year,
                        student_phone, student_email_Id, dob, gender, age, guardian_name, guardian_phone
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                connection.query(
                    studentSql,
                    [
                        user_id, roll_no, f_name, m_name, l_name, department, course_year,
                        student_phone, student_email_Id, dob, gender, age, guardian_name, guardian_phone
                    ],
                    (studentErr) => {
                        if (studentErr) {
                            return res.status(500).json({ message: "Error saving student row", error: studentErr.message });
                        }
                        res.json({ success: true, message: "Student registered successfully", student_id: user_id });
                    }
                );
            }
        );
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// ==========================
// 🛏️ ROOM & BOOKING ROUTES
// ==========================

// Get all rooms (supports both student & general room views)
app.get(['/rooms', '/api/rooms'], (req, res) => {
    const userId = req.query.user_id;

    const query = `
        SELECT 
            h.hostel_name, r.room_id, r.hostel_id, r.room_type,
            r.capacity, r.occupied, r.rent, r.status,
            CASE 
                WHEN s.room_id = r.room_id THEN 'booked'
                ELSE r.status
            END AS booking_status
        FROM rooms r
        JOIN hostels h ON r.hostel_id = h.hostel_id
        LEFT JOIN students s ON s.student_id = ?
        ORDER BY h.hostel_name, r.room_id;
    `;

    connection.query(query, [userId || null], (err, results) => {
        if (err) {
            console.error('Error loading rooms:', err);
            return res.status(500).json({ message: 'Error loading rooms', error: err });
        }
        res.json(results);
    });
});

// Admin room list filtered by admin_id
app.get("/admin/rooms", (req, res) => {
    const admin_id = req.query.admin_id;

    let query = `
        SELECT 
            r.room_id, r.room_type, r.capacity, r.occupied, r.status, r.rent, 
            h.hostel_name
        FROM rooms r
        INNER JOIN hostels h ON r.hostel_id = h.hostel_id
    `;
    const params = [];

    if (admin_id) {
        query += ` WHERE h.admin_id = ?`;
        params.push(admin_id);
    }

    connection.query(query, params, (err, results) => {
        if (err) {
            return res.status(500).json({ message: "Server error" });
        }
        res.json(results);
    });
});

// Universal room booking logic
const handleRoomBooking = (req, res) => {
    const { room_id, student_id } = req.body;
    console.log("📩 Room booking attempt:", { room_id, student_id });

    if (!room_id || !student_id) {
        return res.status(400).json({ message: "Missing room_id or student_id" });
    }

    // 1. Check if student already has a booked room
    connection.query('SELECT room_id FROM students WHERE student_id = ?', [student_id], (err, studentResult) => {
        if (err) return res.status(500).json({ message: "Error checking student", error: err });

        if (studentResult.length > 0 && studentResult[0].room_id) {
            return res.status(400).json({ message: "You already have a booked room." });
        }

        // 2. Fetch room info
        connection.query('SELECT hostel_id, capacity FROM rooms WHERE room_id = ?', [room_id], (err2, roomResult) => {
            if (err2 || roomResult.length === 0) {
                return res.status(404).json({ message: "Room not found" });
            }

            const { hostel_id, capacity } = roomResult[0];

            // 3. Count occupied bookings
            connection.query('SELECT COUNT(*) AS bookedCount FROM students WHERE room_id = ?', [room_id], (err3, countResult) => {
                if (err3) return res.status(500).json({ message: "Error counting bookings", error: err3 });

                const bookedCount = countResult[0].bookedCount;
                if (bookedCount >= capacity) {
                    return res.status(400).json({ message: "Room is already full." });
                }

                // 4. Update student with assignment
                const updateStudent = 'UPDATE students SET room_id = ?, hostel_id = ? WHERE student_id = ?';
                connection.query(updateStudent, [room_id, hostel_id, student_id], (err4) => {
                    if (err4) return res.status(500).json({ message: "Error assigning room", error: err4 });

                    // 5. Update room occupied count and status
                    const newBookedCount = bookedCount + 1;
                    const newStatus = newBookedCount >= capacity ? 'full' : 'available';

                    const updateRoom = 'UPDATE rooms SET occupied = ?, status = ? WHERE room_id = ?';
                    connection.query(updateRoom, [newBookedCount, newStatus, room_id], (err5) => {
                        if (err5) console.warn("⚠️ Room status update warning:", err5);

                        res.json({
                            success: true,
                            message: "Room booked successfully!",
                            student_id,
                            room_id,
                            hostel_id,
                            room_status: newStatus
                        });
                    });
                });
            });
        });
    });
};

app.post('/api/book-room', handleRoomBooking);
app.post('/admin/book-room', handleRoomBooking);
app.post('/book-room', handleRoomBooking);

// ==========================
// 💳 FEE & PAYMENT ROUTES
// ==========================

// Get payment details for a student
app.get("/api/payment/:student_id", (req, res) => {
    const { student_id } = req.params;

    const query = `
        SELECT s.student_id, s.room_id, r.rent, f.*
        FROM students s
        LEFT JOIN rooms r ON s.room_id = r.room_id
        LEFT JOIN fee_payments f ON s.student_id = f.student_id
        WHERE s.student_id = ?;
    `;

    connection.query(query, [student_id], (err, results) => {
        if (err) return res.json({ error: "Database error fetching payment data." });
        if (results.length === 0) return res.json({ error: "Student not found." });

        const data = results[0];

        if (!data.fee_payment_id) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7);

            const insertQuery = `
                INSERT INTO fee_payments (student_id, amount, due_date, status)
                VALUES (?, ?, ?, 'unpaid');
            `;

            connection.query(insertQuery, [student_id, data.rent || 4500, dueDate], (insertErr) => {
                if (insertErr) return res.json({ error: "Could not create fee payment record." });

                connection.query(query, [student_id], (err2, updated) => {
                    if (err2) return res.json({ error: "Error refetching payment record." });
                    const row = updated[0];
                    res.json({
                        student: { student_id: row.student_id, room_id: row.room_id },
                        payment: row
                    });
                });
            });
        } else {
            res.json({
                student: { student_id: data.student_id, room_id: data.room_id },
                payment: data
            });
        }
    });
});

// Mark student fee payment as completed
app.post("/api/pay/:student_id", (req, res) => {
    const { student_id } = req.params;
    const { payment_method, remarks } = req.body;

    const transaction_id = "TXN" + Date.now();
    const payment_date = new Date();

    const updateQuery = `
        UPDATE fee_payments
        SET status='paid',
            payment_method=?,
            transaction_id=?,
            remarks=?,
            payment_date=?
        WHERE student_id=?;
    `;

    connection.query(
        updateQuery,
        [payment_method || 'UPI', transaction_id, remarks || 'Paid via portal', payment_date, student_id],
        (err, result) => {
            if (err) return res.status(500).json({ error: "Failed to update payment." });
            if (result.affectedRows === 0) return res.status(404).json({ error: "No fee record found for student." });

            res.json({ success: true, message: "Payment successful! 🎉", transaction_id });
        }
    );
});

// General fees listing endpoint
app.get(['/fees', '/fee_payments', '/api/fees'], (req, res) => {
    const query = `
        SELECT f.*, s.f_name, s.l_name, h.hostel_name 
        FROM fee_payments f
        LEFT JOIN students s ON f.student_id = s.student_id
        LEFT JOIN hostels h ON s.hostel_id = h.hostel_id;
    `;
    connection.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: "Failed to load fee payments" });
        res.json(results);
    });
});

// ==========================
// 🚀 START SERVER
// ==========================
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));