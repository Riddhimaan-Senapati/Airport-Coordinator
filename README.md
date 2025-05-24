# Airport Coordinator App
This is a simple website to help international students coordinate with other international students when they are going to arrive at an airport. It takes in your email address (currently only accepts @umass.edu email accounts), flight arrival time and your airport as well as a threshold of how long you are willing to stay at the airport. It then shows the email address and flight arrival times of those people who are arriving at the airport between your flight arrival time and the threshold you set.

## What the application can do:
- **Connect Students:** Find and connect with other UMass students arriving at the same airport.
- **Flexible Timing:** Users can set their preferred waiting threshold to find students arriving within their specified timeframe.
- **Secure Platform:** The platform is exclusive to UMass students with verified @umass.edu email addresses, and includes user authentication (signup and signin).
- **Flight Data Submission:** Allows users to submit their flight arrival details (email, arrival date/time, airport).
- **Filtered Search:** Enables users to search for other students arriving at the same airport within a specific time window relative to their own arrival.

## Technologies Used:
- **Frontend:** Built using React and Next.js. Utilizes UI components from Shadcn UI and lucide-react
- **Backend:** Developed with Node.js and Express.js.
- **Database:** Uses MongoDB, connected via Mongoose.
- **Authentication:** Implements secure user authentication with bcrypt for password hashing and JWT for token management.
- **Hosting:** Frontend hosted on Vercel, Backend hosted on Railway.

# Inspiration

I was inspired by how it difficult it was to coordinate among international students for a rideshare. It involved going through hundreds of WhatsApp messages. So I decided to create a website that would act as place where people could input their flight arrival time and find people who were close by.

# How I built it
I built it using React, Mongo DB, express and hosted on vercel.
