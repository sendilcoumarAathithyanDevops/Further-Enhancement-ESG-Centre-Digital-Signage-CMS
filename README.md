# RP ESG Centre Digital Signage CMS

This version includes the administrator **Display Scheduler**, Windows **Display Agent**, remote kiosk Chrome control, Windows sleep, and experimental Wake-on-WLAN.

Start with:

- `SCHEDULER_SLEEP_WAKE_NOTES.md`
- `database/20260703_scheduler_sleep_wake_migration.sql`
- `display-agent/README.md`

The supplied ZIP intentionally excludes real `.env` files, uploaded media, `node_modules`, and the production build directory.

---

## Test Accounts

Use the following fallback database accounts to test the application:

| Role | Username | Password |
| --- | --- | --- |
| Administrator | `admin` | `admin` |
| Producer | `producer` | `producer` |
| Test administrator | `testadmin` | `Test123!` |

Open the login page at [http://localhost:3000](http://localhost:3000).

## MySQL configuration and local failover

The backend reads database settings from `Backend/.env`. The primary connection can point to Railway or another MySQL server. To use a local MySQL database when the primary is unavailable, add these optional settings:

```env
DB_FALLBACK_HOST=localhost
DB_FALLBACK_PORT=3306
DB_FALLBACK_USER=root
DB_FALLBACK_PASSWORD=your-local-mysql-password
DB_FALLBACK_NAME=fyp_cms
DB_FALLBACK_SSL=false
```

Create the local database and import `FYP CMS System Database.sql` into it before starting the backend. The backend first checks the primary, then the local SQL fallback, and uses its JSON file store only if neither SQL database is available. If it switches to the local database after startup, it stays on that database until the backend restarts.

For an existing database, run `node Backend/migrations/add-display-power-schedules.js` from the project root to add the display power-scheduling table required by the backend.

The two SQL databases are **not automatically synchronized**. The local database must be populated and kept current separately; this connection failover alone does not replicate data or copy writes back to Railway. Keep all database passwords in the ignored `Backend/.env` file and never commit them.

## AI Support with Ollama

The producer and administrator accounts include an AI support chat bubble. The backend sends chat requests to Ollama at `http://localhost:11434` by default.

### Keep Ollama running

1. Install Ollama and open the Ollama desktop application. Ollama normally runs in the background.
2. To start Ollama manually:

   ```powershell
   ollama serve
   ```

3. Install and verify the configured support model:

   ```powershell
   ollama pull bonsai-2
   ollama list
   ```

4. Confirm that Ollama is reachable:

   ```powershell
   Invoke-RestMethod http://localhost:11434/api/tags
   ```

5. Restart Ollama after changing the Ollama configuration or support model.

To start Ollama automatically when Windows starts, add a shortcut to Ollama in the Windows Startup folder (`Win + R`, then enter `shell:startup`). A typical Ollama executable path is:

```text
C:\Users\<username>\AppData\Local\Programs\Ollama\ollama.exe
```

Add these optional settings to `Backend/.env`:

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_SUPPORT_MODEL=bonsai-2
```

If the configured model is unavailable, run `ollama pull bonsai-2`, or update `OLLAMA_SUPPORT_MODEL` to a model listed by `ollama list`.

---

## Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
