# 🏢 Hostel Management System

A full-stack web application designed to streamline hostel operations, automate student record handling, facilitate room allocations, and manage fee payment records. Built with Express.js, Node.js, and a MariaDB/MySQL relational backend.

---

## 🚀 Features

- **Role-Based Authentication**: Secure sign-up and login workflows for students and hostel administrators utilizing password encryption via `bcrypt`.
- **Student Profile Management**: Complete profile management tracking student details, emergency contacts, academic year, and room allocations.
- **Room Allocation & Capacity Tracking**: Real-time room booking with automated capacity checks, dynamically updating room status between `available` and `full`.
- **Hostel Administration Panel**: Dedicated admin interface allowing wardens to view student rosters, monitor room occupancies, and review hostel details.
- **Fee Management System**: Integrated payment ledger tracking pending dues, payment dates, transaction IDs, and receipt status.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MariaDB / MySQL
- **Security**: Bcrypt password hashing, CORS
- **Frontend**: HTML5, Tailwind CSS, JavaScript (Fetch API)

---

## 🗄️ Database Architecture

The application connects to a MariaDB relational database (`hosteldb`) with key entities:

- `users`: Credentials and role-based access (`user_id`, `password`, `role`).
- `students`: Profile data and foreign key assignments to rooms and hostels.
- `hostels`: Hostel properties, capacities, and assigned administrators.
- `rooms`: Room inventory, room type, pricing, occupancy counts, and availability status.
- `admins`: Administrative contact details and warden profiles.
- `fee_payments`: Financial transaction records, due dates, statuses, and receipt metadata.

---

## ⚙️ Getting Started

### Prerequisites

- Node.js (v18+)
- MariaDB or MySQL running locally (e.g., via XAMPP)

