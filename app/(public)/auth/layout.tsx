const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-neutral-950 flex relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=2590&auto=format&fit=crop" 
          alt="Nature Background" 
          className="w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-neutral-950/40" />
      </div>

      {/* Content Container */}
      <div className="container relative z-10 mx-auto grid lg:grid-cols-2 h-full min-h-screen">
        {/* Left Side - Branding Text */}
        <div className="hidden lg:flex flex-col justify-center p-12">
          <h1 className="font-serif text-6xl text-white italic mb-6 leading-tight">
            Welcome to<br />Tropicana
          </h1>
          <p className="text-neutral-200 text-lg max-w-md font-light tracking-wide">
            Experience luxury hospitality across the globe
          </p>
        </div>
        
        {/* Right Side - Form */}
        <div className="flex items-center justify-center p-8">
          <div className="w-full max-w-[480px] bg-neutral-950/80 backdrop-blur-md p-10 border border-white/10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
