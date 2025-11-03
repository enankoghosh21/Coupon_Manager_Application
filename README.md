# 🏷️ Coupon Manager

**Coupon Manager** is a React + TypeScript web application for creating, managing, and tracking discount coupons in an organized way.  
It’s designed for e-commerce businesses, marketing teams, and admin users who need full control over coupon lifecycle, validity, and usage analytics.

---

## 🚀 Features

- **Create & Manage Coupons** – Add, edit, and delete coupons with fields like code, discount %, expiry date, and usage limits.  
- **Search & Filter** – Quickly find coupons by name, type, or status.  
- **Validation Rules** – Prevent duplicates and expired coupon usage.  
- **Analytics Dashboard** – Track active, expired, and redeemed coupons.  
- **Responsive UI** – Built with React, Tailwind (or Material UI if applicable), and TypeScript for a clean, modern interface.  
- **Secure Data Handling** – Uses environment variables for API keys and tokens.

---

## 🧩 Tech Stack

| Category | Technology |
|-----------|-------------|
| Frontend Framework | React (TypeScript) |
| Package Manager | npm / yarn / pnpm |
| Styling | Tailwind CSS / Material UI / Styled Components |
| State Management | React Context / Redux Toolkit (if applicable) |
| API Integration | Axios / Fetch API |
| Build Tool | Vite / CRA / Webpack (depending on setup) |
| Backend | Express (TypeScript) + SQLite |

---

## ⚙️ Installation

Clone the repository and install dependencies.

```bash
git clone https://github.com/<your-username>/coupon-manager.git
cd coupon-manager
npm install
```

If you use **pnpm** or **yarn**, replace the last command accordingly:

```bash
pnpm install
# or
yarn install
```

---

## 🧠 Usage

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

The app should now be running at [http://localhost:5173](http://localhost:5173) (or your configured port).

To start the backend API in development mode (after installing dependencies inside `server/`):

```bash
cd server
npm run dev
```

The REST API will listen on [http://localhost:4000](http://localhost:4000) by default. See [`server/README.md`](server/README.md) for the full endpoint catalog and environment variables.

---

## 🔑 Environment Variables

Create a `.env` file in the project root:

```bash
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_AUTH_TOKEN=your_token_here
```

*(Adjust variable names based on your implementation.)*

---

## 🗂️ Folder Structure

```
coupon-manager/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable UI components
│   ├── pages/              # Route-based components
│   ├── hooks/              # Custom React hooks
│   ├── context/            # App-level state management
│   ├── services/           # API calls and data logic
│   ├── types/              # TypeScript interfaces/types
│   ├── utils/              # Helper functions
│   ├── App.tsx             # Root component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🧪 Scripts

| Command | Description |
|----------|-------------|
| `npm run dev` | Start local development server |
| `npm run build` | Create optimized production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint checks |
| `npm run format` | Format code using Prettier |

---

## 🧰 Recommended Extensions (for VS Code)

- **ESLint**
- **Prettier – Code Formatter**
- **Tailwind CSS IntelliSense**
- **React Developer Tools**
- **TypeScript Hero**

---

## 🤝 Contributing

1. Fork the project  
2. Create a feature branch: `git checkout -b feature/your-feature`  
3. Commit your changes: `git commit -m 'Add new feature'`  
4. Push to the branch: `git push origin feature/your-feature`  
5. Open a Pull Request  

---

## 📄 License

This project is licensed under the **MIT License**.  
You’re free to use, modify, and distribute it under the same terms.

---

## 📞 Contact

**Author:** [Your Name]  
**Email:** [your@email.com]  
**GitHub:** [https://github.com/your-username](https://github.com/your-username)

---

> **Tip:** You can extend this README by adding a “Screenshots” section (using `docs/screenshots/`) or a “Backend API Integration” section if your app connects to a service.
