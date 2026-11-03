# Deployment Diagram — SyncDrive

```mermaid
%%{init: {"theme": "dark"}}%%
graph TB
    subgraph CLIENT ["Client Device (Browser)"]
        subgraph BROWSER ["Chrome / Firefox / Safari"]
            subgraph APP ["SyncDrive App — index.html"]
                direction TB
                UI_MOD["UI Module\n(HTML + CSS)"]
                JS_MOD["Logic Module\n(Vanilla JS)"]
                DATA_MOD["Data Module\n(PLACES, SIGNALS, ROUTES)"]
                ALGO_MOD["Algorithm Module\n(optimise, simNG)"]
                MAP_MOD["Map Module\n(Leaflet.js 1.9.4)"]

                UI_MOD --> JS_MOD
                JS_MOD --> DATA_MOD
                JS_MOD --> ALGO_MOD
                JS_MOD --> MAP_MOD
            end
        end
    end

    subgraph CDN1 ["Stadia Maps CDN"]
        TILES["Dark Map Tiles\nalidade_smooth_dark\n{z}/{x}/{y}.png\n(free tier, no key)"]
    end

    subgraph CDN2 ["unpkg CDN"]
        LEAFLET["Leaflet.js 1.9.4\nleaflet.css + leaflet.js"]
    end

    subgraph CDN3 ["Google Fonts CDN"]
        FONTS["Inter Font\nwoff2 files"]
    end

    subgraph GITHUB ["GitHub — ParthPuri/SyncDrive"]
        REPO["master branch\ncode/index.html\njournals/\ndiagrams/\nproject-report-*/"]
        PAGES["GitHub Actions\n(mkdocs CI/CD)\nAuto-deploy on push"]
    end

    MAP_MOD -- "HTTP GET tile requests" --> TILES
    BROWSER -- "Load on startup" --> LEAFLET
    BROWSER -- "Load on startup" --> FONTS
    CLIENT -- "git push" --> REPO
    REPO --> PAGES

    style CLIENT fill:#1c1c2e,stroke:#0a84ff,color:#fff
    style CDN1 fill:#1e2e1e,stroke:#30d158,color:#fff
    style CDN2 fill:#2e2418,stroke:#ffd60a,color:#fff
    style CDN3 fill:#2e1818,stroke:#ff453a,color:#fff
    style GITHUB fill:#18181e,stroke:#636366,color:#fff
```

## Notes

| Component | Location | Notes |
|---|---|---|
| Application | Client browser | Single HTML file, no server |
| Map tiles | Stadia CDN | Free tier, no API key needed |
| Leaflet.js | unpkg CDN | Loaded at startup |
| Inter font | Google Fonts CDN | Loaded at startup |
| All data | Embedded in HTML | PLACES, SIGNALS, ROUTES as JS objects |
| All logic | Embedded in HTML | Optimizer and simulator run in-browser |
| CI/CD | GitHub Actions | mkdocs auto-deploy on master push |

> **Key point:** There is no backend server. The application is entirely client-side. The only network requests at runtime are tile fetches from Stadia Maps.
