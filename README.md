# twilio2factor

twilio2factor is a small and simple project used as an initial proof of concept to utilize the great Twilio API combined with node.js and a mongoDB backend to perform simple two factor authentication using voice and SMS. This is a very simple setup and is not recommended for deployment as a production two factor authentication system but it is good enough to give a general idea of how this could be done.

## Features

* Registration of a user and their phone number
* Two factor login using a short lived key that is sent via SMS Text to the user and which expires 2 minutes after it is issued
* Two factor login using a short lived key that is provided to the user via a voice call and which expires 2 minutes after it is issued

## Things to do

* Utilize device/client finger printing to identify a device and match with a user in order to allow for two factor auth only when coming from a new device
* More testing of various attack vectors that could allow the system to be compromised
* Review brute force success failure variation as the key size (number of characters) and complexity varies along with the key life duration

## Dependencies

* Express
* Jade
* Less
* Mersenne
* Bcrypt
* Mongoose
* Node-uuid
* Twilio
* Zoneinfo
* mongoDB

## Installation

* Grab the appropriate mongoDB for your environment at http://www.mongodb.org/downloads and install as directed on the mongoDB site
* Install node.js and npm as documented at https://github.com/joyent/node/wiki/Installation
* Add the dependancies ```npm install express less mersenne bcrypt mongoose node-uuid twilio zoneinfo```
* Get your free Twilio developer account at http://www.twilio.com/
* Edit the config.js file with your Twilio information, hostname, and phone number
* Launch the app and have fun

# License (MIT License)

Copyright (c) 2011 Chad Skidmore <chad@skidmore.org>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
