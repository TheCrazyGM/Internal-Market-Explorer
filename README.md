# Hive Trade Feed
shows users who use internal hive market


# how to run on any webserver that serves static content
Copy the files inside "app" folder to the server root.


# how to run on localhost with Python

1. Clone Repo

```
git clone -b main "git@github.com:TheCrazyGM/Internal-Market-Explorer.git" .
```

2. Run local server (eg. python3)

```
python3 -m http.server 8000 -d app
```

3. Visit url

```
http://0.0.0.0:8000/
```
