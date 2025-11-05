# 🗂️ AssetManager

A full-stack **Node.js + Express + PostgreSQL** application that lets users securely upload, manage, and delete digital assets (like images, PDFs, etc.) on **AWS S3**, with **JWT-based authentication** and **role-based access control** for admin and regular users.

---

## 🚀 Features

- 🔐 User authentication with JWT (Login / Register)
- 🧑‍💼 Role-based access (admin / user)
- ☁️ File upload and delete on AWS S3
- 🗃️ PostgreSQL database with assets and users tables
- 🧾 Webhook logging for file activities
- ⚙️ Protected routes for admin and users
- 🧰 Clean modular structure (routes, middleware, db)
- 🧹 Environment-based configuration using `.env`

---

## 🧠 Tech Stack

**Backend:** Node.js, Express  
**Database:** PostgreSQL  
**Storage:** AWS S3  
**Hosting:** AWS EC2  
**Version Control:** Git + GitHub  
**Auth:** JWT (JSON Web Token)

---

## ⚙️ Environment Variables

Create a `.env` file with the following:

```env
PORT=5000

DB_USER=mustafa
DB_PASSWORD=123456
DB_HOST=localhost
DB_PORT=5432
DB_NAME=assetmanager

JWT_SECRET=myverysecretkey

AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-bucket-name

