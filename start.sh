#!/bin/bash\ncd dist\nnpm install --production\nnpx prisma db push\nnode app.js
