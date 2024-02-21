# Express Service
<p align="left">
    <a href="https://discord.gg/5JUqZjzmYJ" alt="Discord Invite"><img src="https://img.shields.io/discord/981394195812085770?label=Support&logo=discord&logoColor=white" /></a>
</p>

This is the backend web project that supports the [GMod Express Addon](https://github.com/cfc-Servers/gm_express).

## Deploy your own

<details>
<summary><h3>Deploy on Cloudflare :cloud:</h3></summary>
<br>
It's super straightforward to run your own Express instance on Cloudflare!

It should only take a couple of minutes, just click this button! (more instructions below):

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button?paid=true)](https://deploy.workers.cloudflare.com/?url=https://github.com/CFC-Servers/gm_express_service&paid=true)


### When it asks you to make a new API Token, be sure you select the "Edit Cloudflare Workers" template:
![chrome_88omaNQrgW](https://user-images.githubusercontent.com/7936439/202330035-96062125-2b33-4222-ab9b-9c3b25bde666.png)

### Then, set the Account Resources and Zone Resources to "All accounts" and "All zones" respectively:
![chrome_S79PHew0KS](https://user-images.githubusercontent.com/7936439/202330090-0bcbd1ca-33d9-4d53-8b23-1d6a48f4324f.png)

### Click "Continue to summary"
![chrome_KGNhnsgTi7](https://user-images.githubusercontent.com/7936439/202330183-6a64cf40-acaa-4d96-b9a1-b43138b32719.png)

### Click "Create Token"
![chrome_YB68lnT9rj](https://user-images.githubusercontent.com/7936439/202330225-0faeb3ed-2299-4845-901d-17ba5e4e76da.png)

### Copy your API Token into the setup page
![chrome_HxAtd02BXx](https://user-images.githubusercontent.com/7936439/202330247-8872dfcd-e16f-446a-9ea2-68c4384eed5c.png)

![chrome_5xgZ8Z0zRg](https://user-images.githubusercontent.com/7936439/202330307-8756142d-42e5-4e85-919a-1e4c335afff3.png)

</details>

<details>
<summary><h3>Self-Hosted :passenger_ship:</h3></summary>
<br>

The Express Service comes out-of-the-box ready to self-host.

The included `docker-compose.yml` has everything you need to get started. All you need is [Docker Compose](https://docs.docker.com/compose/install/).

Once you clone the repository, you just start it with Compose:
```bash
docker compose up --build -d
```

The Express Service will (by default) be available at both `127.0.0.1:3000` and your public IP, port 3000.

You can change the address that Express binds to by changing the `API_HOST`/`API_PORT` settings in the `.env` file.
For example, if you were going to serve Express from behind a Reverse Proxy, you might want to set `API_HOST=127.0.0.1`.
</details>

---

### Configuring the addon for self-hosting
If you host your own Express instance, you'll need to change a couple of convars.

<br>

#### **`express_domain`**
This convar tells both the Server _and_ Client what domain they can find Express at. By default, it's `gmod.express` - the public & free Express instance.

If you run Express from Cloudflare, you'll need to update this convar with whatever your Cloudflare Worker URL is.
By default it's a `*.workers.dev` domain, but if you configure it to use one of your domains, you'll of course want to set that instead.

<br>

#### **`express_domain_cl`**
This convar lets you set a specific domains for Clients. If you leave it empty, both Server and Client will use `express_domain`.

This convar is useful if you self-host Express on the same machine that runs your Garry's Mod server. In that setup, you'll want to do something like this:
```
# Tell the server to find Express locally
# (me.cfc.gg redirects to 127.0.0.1 to get around Gmod's localhost HTTP restrictions)
express_domain "me.cfc.gg:3000"

# Tell the clients to find it at your server's public IP (or, ideally, HTTPS-ready Domain)
express_domain_cl "23.227.174.90:3000"
```

If you host on Cloudflare, you should leave this convar empty (`express_domain_cl ""`)
