# Course Registration & Elective Allocation System

A modern, full-stack university course registration and elective allocation platform built with **Django REST Framework**, **React 19 (Vite + Tailwind CSS)**, **PostgreSQL**, and **Redis**. The system automates course preference matching using the **Gale-Shapley (Deferred Acceptance) algorithm** with multi-attribute academic priority scoring.

---

## Key Features

- **Role-Based JWT Authentication**:
  - Secure authentication via `djangorestframework-simplejwt`.
  - Roles (`FACULTY` vs `STUDENT`) and permissions embedded directly in token claims.
  - Dedicated routes: `/login`, `/register`, and `/dashboard` (automatically redirects to the student or faculty portal based on verified token identity).
- **Faculty Elective Management**:
  - Create elective bundles with title, description, and a **required submission deadline**.
  - **Whole-Elective Criteria (Optional)**: Minimum CGPA, target degrees (B.Tech, M.Tech), target branches (CSE, ECE, ME, etc.), and allowed semesters.
  - **Dynamic Course Sub-List**: Add multiple courses to an elective, each with individual `Course_Code`, `course_Name`, `Credits`, **individual seat capacity**, and **individual CGPA cutoff**.
  - **Automated Gale-Shapley Matching**: The matching engine automatically executes before publishing results when the deadline arrives or upon one-click publication.
- **Student Portal**:
  - Intuitive, distraction-free interface (no algorithm clutter).
  - Browse active elective offerings, seat limits, and eligibility cutoffs.
  - Submit ranked course preferences up to the elective's allowed limit.
  - View allocated course results once published by faculty.
- **Enterprise Light-Mode Aesthetics**:
  - High-contrast editorial theme: warm cream/off-white background (`#F9F8F6` / `#F3F1EC`), deep forest green accents (`#1B4D3E`, `#2E6F5A`), mint status pills (`#E8F5E9`), and crisp card borders (`#E5E0D8`).
- **Production Architecture**:
  - Powered by **PostgreSQL 15** and **Redis 7** via Docker Compose (SQLite is strictly prohibited).
  - Background task and caching architecture ready for scale.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.10+, Django 6, Django REST Framework, SimpleJWT, Celery |
| **Database** | PostgreSQL 15 |
| **Cache / Queue** | Redis 7 |
| **Frontend** | React 19, Vite, Tailwind CSS v4, Lucide Icons, Axios |
| **DevOps** | Docker, Docker Compose |

---

## Project Structure

```text
course-registration-django/
├── backend/
│   ├── accounts/             # User models, JWT serializers, auth endpoints
│   ├── apps/
│   │   └── allocation/       # Gale-Shapley matching algorithm & priority engine
│   ├── config/               # Django settings, WSGI/ASGI, root URLs
│   ├── courses/              # Elective groups, courses, sections, seeder
│   ├── manage.py
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── api/              # Axios HTTP client with JWT interceptors
│   │   ├── context/          # AuthContext for state & token management
│   │   ├── pages/            # LoginPage, RegisterPage, DashboardRouter, FacultyDashboard, StudentDashboard
│   │   └── components/       # UI cards, modals, navigation
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml        # PostgreSQL (5432) & Redis (6379) services
└── README.md
```

---

## Prerequisites

Ensure you have the following installed on your machine:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL and Redis)
- [Python 3.10+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/) & `npm`
- [Git](https://git-scm.com/)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/raj-ranjan-70/course-registration-django.git
cd course-registration-django
```

### 2. Start PostgreSQL & Redis via Docker

```bash
docker-compose up -d
```
> This starts PostgreSQL on port `5432` and Redis on port `6379`.

### 3. Setup and Start the Backend

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   - **Windows**:
     ```powershell
     python -m venv venv
     venv\Scripts\activate
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run database migrations:
   ```bash
   python manage.py migrate
   ```
5. Seed the database with initial accounts:
   ```bash
   python manage.py seed_data
   ```
6. Start the Django development server:
   ```bash
   python manage.py runserver
   ```
   The backend API will be available at `http://localhost:8000/api/`.

---

### 4. Setup and Start the Frontend

1. Open a new terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

---

## Demo Accounts

The seeder command (`python manage.py seed_data`) creates 4 accounts with zero mock courses so faculty can create courses from scratch:

| Role | Name | Email / Username | Password | Notes |
|---|---|---|---|---|
| **Faculty** | Dr. Alan Turing | `faculty1@univ.edu` | `Password@123` | Can create electives, set deadlines, and publish matches |
| **Faculty** | Dr. Grace Hopper | `faculty2@univ.edu` | `Password@123` | Can create electives and manage courses |
| **Student** | Alice Chen | `student1@univ.edu` | `Password@123` | Reg No: `REG2026001`, CGPA: 9.20 |
| **Student** | Bob Miller | `student2@univ.edu` | `Password@123` | Reg No: `REG2026002`, CGPA: 8.40 |

> **Tip**: The login page (`/login`) includes 1-click quick-fill cards for each of these demo accounts for rapid testing.

---

## Workflows

### Faculty Workflow
1. Log in with a faculty account (e.g., `faculty1@univ.edu`).
2. Go to **Create Elective**.
3. Enter the **Elective Title**, **Short Description**, and **Submission Deadline** (required).
4. Specify optional whole-elective criteria (Minimum CGPA, Allowed Semesters, Target Degrees, Target Branches).
5. Add courses to the elective using **+ Add Course to Elective**:
   - Provide `Course Code`, `Course Title`, and `Credits`.
   - Specify **individual Seat Capacity** and **individual Min CGPA** for each course.
6. Click **Create & Publish Elective**.
7. Once students submit their choices, click **Publish Results & Run Allocation** (the Gale-Shapley matching algorithm runs automatically before results are finalized).

### Student Workflow
1. Log in with a student account (e.g., `student1@univ.edu`).
2. Navigate to `/dashboard` to view available elective offerings.
3. Review courses, credits, seat caps, and prerequisites.
4. Select and rank your course preferences (1st Choice, 2nd Choice, etc.).
5. Submit preferences before the elective's deadline.
6. Once results are published, the dashboard displays the matched course assignment.

---

## Running Automated Tests

Run the full Django test suite (covering authentication, elective groups, validation, and Gale-Shapley allocation):

```bash
python manage.py test accounts courses apps.allocation
```

---

## Environment Configuration

Default database and cache settings in `backend/config/settings.py` work out-of-the-box with the included `docker-compose.yml`:

| Variable | Default Value | Description |
|---|---|---|
| `DB_NAME` | `coursereg_db` | PostgreSQL Database name |
| `DB_USER` | `postgres` | PostgreSQL Username |
| `DB_PASSWORD` | `password` | PostgreSQL Password |
| `DB_HOST` | `localhost` | PostgreSQL Host |
| `DB_PORT` | `5432` | PostgreSQL Port |
| `REDIS_HOST` | `localhost` | Redis Host |
| `REDIS_PORT` | `6379` | Redis Port |

---

## License

This project is licensed under the [MIT License](LICENSE).
