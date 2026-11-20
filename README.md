<div align="center">
  <a href="https://imagen.nabarun.app">
    <img src="./public/logo.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Imagen</h3>

  <p align="center">
    Say hello to your creative side!
    <br />
    <a href="https://imagen.nabarun.app"><strong>View Project »</strong></a>
    <br />
    <br />
    <a href="https://github.com/nabarvn/imagen/issues">Report Bug</a>
    •
    <a href="https://github.com/nabarvn/imagen/issues">Request Feature</a>
  </p>
</div>

## Overview

<div align="center">
  <img src="./public/screenshot.png" alt="Screenshot">
</div>

<br />

Imagen generates images from text using the OpenAI GPT Image model. Type in a prompt to create an image, or use the suggestion button if you need an idea. Every generated image is saved to a shared gallery.

## Architecture

The diagram below illustrates the high-level architecture of the Imagen application.

```mermaid
graph TD
    User --> Frontend[Next.js Frontend];
    Frontend -- "API Requests" --> Backend[Azure Functions];
    Backend -- "Rate Limiting & Caching" --> Redis[Upstash Redis];
    Backend -- "Decisions<br>+<br>Prompts&nbsp;&amp;&nbsp;Image&nbsp;Generation" --> OpenAI[OpenAI API];
    Backend -- "Image Upload" --> Storage[Azure Blob Storage];
    Storage -- "Serves Images" --> Frontend;

    style Frontend fill:#F5F5F5,color:#000,stroke:#333,stroke-width:2px;
    style Backend fill:#3CCBF4,color:#000,stroke:#333,stroke-width:2px;
    style Redis fill:#00E9A3,color:#000,stroke:#333,stroke-width:2px;
    style OpenAI fill:#74AA9C,color:#000,stroke:#333,stroke-width:2px;
    style Storage fill:#3CCBF4,color:#000,stroke:#333,stroke-width:2px;
```

## Running Locally

This project is split into two main parts: a Next.js frontend and an Azure Functions backend. Follow these steps to get both services running on your local machine.

### Prerequisites

This setup requires:

- [Node.js](https://nodejs.org/en) v24.11.1 ([nvm](https://github.com/nvm-sh/nvm) recommended)
- [Visual Studio Code](https://code.visualstudio.com/)
- [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local) v4+ (can be installed via `npm install -g azure-functions-core-tools@4`)
- [Azure Functions for VS Code extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions)
- An active [Azure account](https://azure.microsoft.com/en-us/free) (a free account is sufficient)

### 1. Cloning the Repository

First, clone the repository to your local machine:

```bash
git clone https://github.com/nabarvn/imagen.git
cd imagen
```

### 2. Backend Setup (Azure Functions)

The backend is powered by Azure Functions. We will use the VS Code extension to create the necessary cloud resources and configure our local environment.

1.  **Sign in to Azure**: Open the project in VS Code. Use the command palette (`Cmd+Shift+P` or `Ctrl+Shift+P`) to run the **`Azure: Sign In`** command and follow the prompts.

2.  **Create Azure Resources**:

    - In the VS Code command palette, run **`Azure Functions: Create Function App in Azure...`**.
    - Choose a unique name, **Windows Consumption (Y1)**, **Node.js 24**, a 64-bit platform, and a geographical region.
    - Crucially, when prompted, choose to **`+ Create new storage account`** and **`+ Create new resource group`**. This ensures everything is linked automatically.

3.  **Download Cloud Settings**:

    - Once the Function App is created, find it in the Azure extension sidebar under your subscription.
    - Expand its tree, right-click on **Application Settings**, and select **`Download Remote Settings...`**.
    - This will automatically create a `local.settings.json` file inside the `/azure` directory, pre-populated with the necessary connection string for your storage account.

4.  **Add API Keys**: Open the newly created `azure/local.settings.json` file. You need to add the following keys to the `Values` object.

| Variable Name              | Description                                     | Where to get it                                                            |
| :------------------------- | :---------------------------------------------- | :------------------------------------------------------------------------- |
| `OPENAI_API_KEY`           | Your secret API key for OpenAI.                 | Create one on the [OpenAI Platform](https://platform.openai.com/api-keys). |
| `UPSTASH_REDIS_REST_URL`   | The REST URL for your Upstash Redis database.   | Find this in your [Upstash Console](https://console.upstash.com/).         |
| `UPSTASH_REDIS_REST_TOKEN` | The REST token for your Upstash Redis database. | Find this in your [Upstash Console](https://console.upstash.com/).         |

### 3. Frontend Setup (Next.js)

The frontend needs to connect to your local backend and know the hostname of your Azure Storage Account to display the generated images.

1.  **Create Environment File**: In the root of the project, create a local environment file by copying the example.

    ```bash
    cp .env.example .env
    ```

2.  **Configure Storage Hostname**:
    - Open the newly created `.env` file.
    - In the `AZURE_STORAGE_HOSTNAME` variable, replace the placeholder `<your-storage-account-name>` with the actual name of the Storage Account you created earlier.
    - You can find your Storage Account name in the VS Code Azure extension sidebar.

### 4. Installing Dependencies

You will need two separate terminals to install dependencies for both the frontend and backend.

> **Note:** Run `nvm use` in the project root to switch to the compatible Node.js version (v24.11.1) before installing dependencies.

- **Terminal 1 (Root Directory):** Install frontend dependencies.

  ```bash
  npm install
  ```

- **Terminal 2 (`azure` Directory):** Install backend dependencies.

  ```bash
  cd azure
  npm install
  ```

### 5. Running the Application

- **Terminal 1 (Root Directory):** Start the frontend.

  ```bash
  npm run dev
  ```

- **Terminal 2 (`azure` Directory):** Start the backend.

  ```bash
  npm start
  ```

### 6. Accessing the Services

Once the services are running, you can access them at the following URLs:

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend**: [http://localhost:7071](http://localhost:7071)

## Deployment

The backend is deployed by `.github/workflows/deploy-functions.yml`. It builds on Windows so native dependencies such as `sharp` match the Windows Function App. Do not deploy the backend directly from VS Code.

1. In the Azure portal, configure the Function App:
   - Set `WEBSITE_RUN_FROM_PACKAGE` to `1`.
   - Set `SCM_DO_BUILD_DURING_DEPLOYMENT` to `false`.
   - Confirm the platform is 64-bit.
   - Add the API keys from `azure/local.settings.json`. This file is gitignored and is not uploaded by GitHub.
2. Download the Function App's publish profile from its Azure portal overview.
3. In the GitHub repository, add these **Actions repository secrets**:
   - `AZURE_FUNCTIONAPP_NAME`: the exact Function App name.
   - `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`: the complete publish-profile XML.
4. Push a backend change to `main`, or run **Deploy Azure Functions** manually from the GitHub Actions tab.

After the workflow succeeds, Azure mounts the new package and restarts the Function App automatically.

Your API is now live! The frontend, when deployed to a service like Vercel, will need its `FUNCTION_APP_URL` environment variable updated to point to your new Azure Function App URL.

## Utility Scripts

You can manage the Redis database from your host machine by running the following commands from the `azure` directory:

- **Clear usage keys**:

  ```bash
  npm run clear-redis:usage
  ```

- **Clear rate limiting keys**:

  ```bash
  npm run clear-redis:rate
  ```

- **Clear all keys from the database**:

  ```bash
  npm run clear-redis:all
  ```

## Entire Tech Stack

### Frontend

- **Language**: [TypeScript](https://www.typescriptlang.org)
- **Framework**: [Next.js](https://nextjs.org)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **Data Fetching**: [SWR](https://swr.vercel.app/docs/getting-started)
- **Identification**: [FingerprintJS](https://fingerprint.com)
- **Deployment**: [Vercel](https://vercel.com)

### Backend

- **Language**: [TypeScript](https://www.typescriptlang.org)
- **Serverless Compute**: [Azure Functions](https://azure.microsoft.com/en-us/products/functions)
- **Blob Storage**: [Azure Blob Storage](https://azure.microsoft.com/en-us/services/storage/blobs)
- **Rate Limiting**: [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted)
- **Usage Tracking**: [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted)
- **LLM Provider**: [OpenAI](https://platform.openai.com/docs/overview)
- **Image Processing**: [Sharp](https://sharp.pixelplumbing.com)

<hr />

<div align="center">Don't forget to leave a STAR 🌟</div>
