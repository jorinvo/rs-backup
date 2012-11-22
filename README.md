##State of the Project:
Check out [#15](https://github.com/jorin-vogel/rs-backup/issues/15)!
#RemoteStorage Backup
Get automated backups of your remoteStorage right into your mailbox.
Dogfood your remoteStorage app without having fear to accidentally loose your data.
This service is for everyone in the [Unhosted community](http://unhosted.org/).

[Checkout existing remoteStorage apps here!](https://github.com/unhosted/website/wiki/State-of-the-movement)

Sign up at http://rs-backup.herokuapp.com.


##Install
* `npm install` the project.
* Make sure you have a running mongoDB instance.
* create a `mail.json` file like:
```{
     "service": "Gmail",
     "auth": {
       "user": "user@gmail.com",
       "pass": "***"
     }
   }```
* Kick off the server with `node server.js`


#License
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or distribute this software, either in source code form or as a compiled binary, for any purpose, commercial or non-commercial, and by any means.

In jurisdictions that recognize copyright laws, the author or authors of this software dedicate any and all copyright interest in the software to the public domain. We make this dedication for the benefit of the public at large and to the detriment of our heirs and successors. We intend this dedication to be an overt act of relinquishment in perpetuity of all present and future rights to this software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to http://unlicense.org/