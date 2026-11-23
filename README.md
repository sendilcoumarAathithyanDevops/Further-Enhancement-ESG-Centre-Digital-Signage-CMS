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

## Reusable ESG templates

Administrators can open **Manage Templates** and choose **Create ESG Template** to design a reusable display layout. Select Environmental, Social, or Governance, add pages and widgets in the template editor, then save it. The active template is available to the team from **My Canvas → Add New Canvas**.

## Pre-publish layout validation

When publishing a draft from **My Canvas**, the CMS checks for missing pages or widget content/media, invalid widget geometry, and widgets outside the display canvas. These blocking issues must be fixed in the editor before publishing. Potential overlaps, text that may be too small, safe-area conflicts, and empty pages are shown as warnings; review them and confirm **Publish anyway** when intentional. Choose **Preview content** to inspect each saved page, then return to the publish review to continue. The backend repeats the blocking checks during publishing, so the validation cannot be bypassed by calling the publish endpoint directly. Unpublishing is unchanged.

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

Before updating an existing database, back it up. From the project root, run these additive migrations for project previews, the display power scheduler, and the Default display category:

```powershell
node Backend/migrations/add-monitor-playlist-pages.js
node Backend/migrations/add-display-power-schedules.js
node Backend/migrations/add-default-monitor-category.js
```

They use the SQL connection in `Backend/.env` and are safe to re-run. Do not re-import `FYP CMS System Database.sql` over a database containing data; the dump includes `DROP TABLE` statements.

When using MySQL, run the additive media catalog and audit log migration before using the Media Library or performing uploads. The JSON fallback store creates these records automatically.

```powershell
node Backend/migrations/add-media-catalog-and-audit.js
```

Administrators can use **Media Library** to search and filter image/video uploads, assign Environmental, Social, or Governance tags, and inspect the canvases where each file is used. The Admin Dashboard shows recent administrator changes and a seven-day change count. Successful administrator changes are recorded with the account, HTTP action, resource path, IP address, and time; request bodies and credentials are not stored.

Administrators can retrieve up to 100 audit entries with `GET /api/admin/audit-logs?limit=50`.

The read-only internal endpoints require an authenticated administrator session:

| Endpoint | Information |
| --- | --- |
| `GET /api/internal/displays` | Display status and category |
| `GET /api/internal/playlists` | Active playlist items and page assignments |
| `GET /api/internal/schedules` | Content schedules with display/project details |
| `GET /api/internal/media` | Uploaded media, category tags, and canvas usage |

Media results can be filtered with `search`, `category`, and `kind` query parameters. For example, `/api/internal/media?category=social&kind=images`.

The two SQL databases are **not automatically synchronized**. The local database must be populated and kept current separately; this connection failover alone does not replicate data or copy writes back to Railway. Keep all database passwords in the ignored `Backend/.env` file and never commit them.

## AI Support with Ollama

AI Support runs locally through Ollama; the browser sends requests to the CMS backend, which connects to Ollama at `http://localhost:11434`. The default model is `bonsai-2`.

1. Install [Ollama](https://ollama.com/download) on the computer running the CMS.
2. Pull the model:

   ```sh
   ollama pull bonsai-2
   ```

   Ollama normally runs as a desktop service. If it is not running, start it with `ollama serve`.
3. Optionally set these values in `Backend/.env` (they are the defaults):

   ```env
   OLLAMA_URL=http://localhost:11434
   OLLAMA_SUPPORT_MODEL=bonsai-2
   ```

4. Start the backend with `npm run start:backend`, then the React app with `npm start`.
5. Sign in as a producer or administrator and open AI Support.

AI requests use CPU inference to avoid GPU/CUDA incompatibilities. This works on machines where Ollama's GPU backend cannot run, but may be slower. To use a different local model, pull it with `ollama pull <model>` and set `OLLAMA_SUPPORT_MODEL` to that model name.

### AI assistant tools and permissions

The assistant provides a small, server-enforced tool set inspired by MCP: read-only display status and dashboard-summary queries for administrators, ESG title/caption suggestions for producers and administrators, and template drafting. Dashboard summaries refresh when the backend starts and every five minutes; answers include the snapshot time. The snapshot contains aggregate counts and recent projects/displays, not recent users' personal details. Display status is read from the CMS monitor records; AI does not control screens. Saving an AI-generated shared template and opening it in a new canvas both require explicit confirmation. Delete operations are not available through the AI assistant.

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
