// pages/_app.js
import '../styles/globals.css';
import { Toaster } from 'sonner';

// Import Inter font
import { Mulish } from 'next/font/google';

// Configure the Inter font
const inter = Mulish({
  subsets: ['latin'],
  variable: '--font-sans', // This makes it available as a CSS variable
  display: 'swap',
});

function MyApp({ Component, pageProps }) {
  return (
    // Apply the font variable to the HTML element for global availability
    <div className={`${inter.variable} font-sans`}>
      <Component {...pageProps} />
      <Toaster />
    </div>
  );
}

export default MyApp;
