zay  | }
0|khwanzay  | 🔍 APP.JS ENCRYPTION MIDDLEWARE: Request body keys: []
0|khwanzay  | 🔍 APP.JS ENCRYPTION MIDDLEWARE: Request body type: object
0|khwanzay  | 🔍 APP.JS ENCRYPTION MIDDLEWARE: Request body: {}
0|khwanzay  | 🔍 DEBUG MIDDLEWARE: Request body keys: []
0|khwanzay  | 🔍 DEBUG MIDDLEWARE: No parent data found in request body
0|khwanzay  | 🔍 DEBUG MIDDLEWARE AFTER SANITIZATION: Request body keys: []
0|khwanzay  | 🔍 DEBUG MIDDLEWARE AFTER SANITIZATION: No parent data found in request body
0|khwanzay  | === authenticateToken START ===
0|khwanzay  | Request: POST /
0|khwanzay  | Request IP: ::ffff:10.9.30.1 Forwarded for: 223.26.20.8
0|khwanzay  | User-Agent: curl/8.14.1
0|khwanzay  | Origin: undefined
0|khwanzay  | Referer: undefined
0|khwanzay  | Headers: {
0|khwanzay  |   host: 'khwanzay.school',
0|khwanzay  |   'user-agent': 'curl/8.14.1',
0|khwanzay  |   'content-length': '1408',
0|khwanzay  |   accept: '*/*',
0|khwanzay  |   authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0ODIiLCJlbWFpbCI6InRlYWNoZXIxQHNjaG9vbC5jb20iLCJyb2xlIjoiVEVBQ0hFUiIsInNjaG9vbElkIjoiMSIsImlhdCI6MTc1NjYxNjU4NywiZXhwIjoxNzU2NzAyOTg3fQ.RpafbuVSlmGtnjSJHBzeUtR6XOc4aFK0G394tHoKGxE',
0|khwanzay  |   'content-type': 'application/json',
0|khwanzay  |   via: '2.0 Caddy',
0|khwanzay  |   'x-forwarded-for': '223.26.20.8',
0|khwanzay  |   'x-forwarded-host': 'khwanzay.school',
0|khwanzay  |   'x-forwarded-proto': 'https',
0|khwanzay  |   'x-real-ip': '223.26.20.8',
0|khwanzay  |   'accept-encoding': 'gzip'
0|khwanzay  | }
0|khwanzay  | Token: Present
0|khwanzay  | Verifying token...
0|khwanzay  | Token verified for user: 482
0|khwanzay  | Decoded token: {
0|khwanzay  |   userId: '482',
0|khwanzay  |   email: 'teacher1@school.com',
0|khwanzay  |   role: 'TEACHER',
0|khwanzay  |   schoolId: '1',
0|khwanzay  |   iat: 1756616587,
0|khwanzay  |   exp: 1756702987
0|khwanzay  | }
0|khwanzay  | Fetching user from database...
0|khwanzay  | User found: 482n teacher1@school.com
0|khwanzay  | === authenticateToken END (User) ===
0|khwanzay  | req.user set with schoolId: 1n
0|khwanzay  | === authorizePermissions START ===
0|khwanzay  | Required permissions: [ 'student:create' ]
0|khwanzay  | User role: TEACHER
0|khwanzay  | User permissions: [
0|khwanzay  |   'school:read',         'user:read',
0|khwanzay  |   'class:read',          'subject:read',
0|khwanzay  |   'student:read',        'staff:read',
0|khwanzay  |   'parent:read',         'student:create',
0|khwanzay  |   'student:update',      'class:create',
0|khwanzay  |   'class:update',        'attendance:create',
0|khwanzay  |   'attendance:read',     'attendance:update',
0|khwanzay  |   'grade:create',        'grade:read',
0|khwanzay  |   'grade:update',        'assignment:create',
0|khwanzay  |   'assignment:read',     'assignment:update',
0|khwanzay  |   'assignment:delete',   'exam:read',
0|khwanzay  |   'exam_timetable:read', 'timetable:read',
0|khwanzay  |   'school:stats',        'user:stats'
0|khwanzay  | ]
0|khwanzay  | === authorizePermissions END: Access granted ===
0|khwanzay  | 🔍 ===== STUDENT CREATION STARTED =====
0|khwanzay  | 🔍 Request body type: object
0|khwanzay  | 🔍 Request body keys: []
0|khwanzay  | 🔍 Full request body: {}
0|khwanzay  | 🔍 Request body user field: undefined
0|khwanzay  | 🔍 Request body parent field: undefined
0|khwanzay  | validateSchoolAccess called with: {
0|khwanzay  |   user: {
0|khwanzay  |     id: 482n,
0|khwanzay  |     uuid: '5ece50eb-a67e-49a2-9a70-d33d331432f3',
0|khwanzay  |     username: 'Admin',
0|khwanzay  |     email: 'teacher1@school.com',
0|khwanzay  |     emailVerified: null,
0|khwanzay  |     phone: null,
0|khwanzay  |     phoneVerified: null,
0|khwanzay  |     password: '$2a$12$AcWxVQg0OOE5qBVq5EuqkOtptHrlAK4fYAbuB90jpUXt86ixaukZW',
0|khwanzay  |     salt: '$2a$12$AcWxVQg0OOE5qBVq5EuqkO',
0|khwanzay  |     firstName: 'Alice',
0|khwanzay  |     middleName: null,
0|khwanzay  |     lastName: 'Smith',
0|khwanzay  |     displayName: null,
0|khwanzay  |     gender: null,
0|khwanzay  |     birthDate: null,
0|khwanzay  |     avatar: null,
0|khwanzay  |     coverImage: null,
0|khwanzay  |     bio: null,
0|khwanzay  |     role: 'TEACHER',
0|khwanzay  |     status: 'ACTIVE',
0|khwanzay  |     lastLogin: 2025-08-31T07:05:57.576Z,
0|khwanzay  |     lastIp: '::ffff:10.9.30.1',
0|khwanzay  |     timezone: 'UTC',
0|khwanzay  |     locale: 'en-US',
0|khwanzay  |     metadata: null,
0|khwanzay  |     schoolId: 1n,
0|khwanzay  |     createdByOwnerId: 1n,
0|khwanzay  |     createdBy: 1n,
0|khwanzay  |     updatedBy: null,
0|khwanzay  |     createdAt: 2025-07-22T07:11:06.216Z,
0|khwanzay  |     updatedAt: 2025-08-31T07:05:57.577Z,
0|khwanzay  |     deletedAt: null,
0|khwanzay  |     school: {
0|khwanzay  |       id: 1n,
0|khwanzay  |       uuid: 'c6542dc4-6d0d-11f0-929c-00163e7402cd',
0|khwanzay  |       name: 'Kawish Educational Complex',
0|khwanzay  |       shortName: 'GIS',
0|khwanzay  |       code: 'GIS2025',
0|khwanzay  |       motto: 'Knowledge is Power',
0|khwanzay  |       about: 'A premium school focused on holistic education.',
0|khwanzay  |       email: 'info@gis.edu',
0|khwanzay  |       phone: '+1234567890',
0|khwanzay  |       fax: '+1234567891',
0|khwanzay  |       website: 'https://www.gis.edu',
0|khwanzay  |       establishedDate: 2010-08-15T00:00:00.000Z,
0|khwanzay  |       principal: 'Dr. Sarah Thompson',
0|khwanzay  |       vicePrincipal: 'Mr. John Smith',
0|khwanzay  |       country: 'United States',
0|khwanzay  |       state: 'California',
0|khwanzay  |       city: 'San Francisco',
0|khwanzay  |       address: '123 Education Ave, District 9',
0|khwanzay  |       postalCode: '94110',
0|khwanzay  |       latitude: 37.7749,
0|khwanzay  |       longitude: -122.4194,
0|khwanzay  |       logo: 'uploads/logos/gis.png',
0|khwanzay  |       coverImage: 'uploads/covers/gis-cover.jpg',
0|khwanzay  |       themeColor: '#0047AB',
0|khwanzay  |       timezone: 'UTC',
0|khwanzay  |       locale: 'en-US',
0|khwanzay  |       currency: 'USD',
0|khwanzay  |       status: 'ACTIVE',
0|khwanzay  |       ownerId: 1n,
0|khwanzay  |       academicSessionId: 1n,
0|khwanzay  |       currentTermId: 1n,
0|khwanzay  |       createdBy: 1n,
0|khwanzay  |       updatedBy: 1n,
0|khwanzay  |       createdAt: 2025-07-30T06:23:57.789Z,
0|khwanzay  |       updatedAt: 2025-07-30T06:23:57.789Z,
0|khwanzay  |       deletedAt: null
0|khwanzay  |     },
0|khwanzay  |     createdByOwner: {
0|khwanzay  |       id: 1n,
0|khwanzay  |       uuid: '0cd92383-6d0e-11f0-929c-00163e7402cd',
0|khwanzay  |       name: 'Rohullah Rahmani',
0|khwanzay  |       email: 'ali.rahmani@example.com',
0|khwanzay  |       emailVerified: 2025-07-30T06:25:56.000Z,
0|khwanzay  |       phone: '+93700000000',
0|khwanzay  |       phoneVerified: 2025-07-30T06:25:56.000Z,
0|khwanzay  |       password: '$2a$12$AcWxVQg0OOE5qBVq5EuqkOtptHrlAK4fYAbuB90jpUXt86ixaukZW',
0|khwanzay  |       salt: '$2a$12$AcWxVQg0OOE5qBVq5EuqkO',
0|khwanzay  |       lastLogin: 2025-07-30T06:25:56.000Z,
0|khwanzay  |       lastIp: '192.168.1.100',
0|khwanzay  |       status: 'ACTIVE',
0|khwanzay  |       timezone: 'Asia/Kabul',
0|khwanzay  |       locale: 'fa-AF',
0|khwanzay  |       metadata: '{"role":"superadmin","notes":"Founder"}',
0|khwanzay  |       createdAt: 2025-07-30T06:25:56.000Z,
0|khwanzay  |       updatedAt: 2025-07-30T06:25:56.000Z,
0|khwanzay  |       deletedAt: null
0|khwanzay  |     },
0|khwanzay  |     teacher: null,
0|khwanzay  |     parent: null,
0|khwanzay  |     student: null,
0|khwanzay  |     staff: null
0|khwanzay  |   },
0|khwanzay  |   schoolId: 1n,
0|khwanzay  |   userRole: 'TEACHER'
0|khwanzay  | }
0|khwanzay  | Prisma error in createStudent: TypeError: Cannot destructure property 'dateOfBirth' of 'studentData.user' as it is undefined.
0|khwanzay  |     at StudentController.createStudent (file:///root/sms/controllers/studentController.js:138:15)
0|khwanzay  | === authenticateToken START ===
0|khwanzay  | Request: GET /
0|khwanzay  | Request IP: ::ffff:10.9.30.1 Forwarded for: 

