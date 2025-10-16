"use client";

export default function NoSubdomainPage() {
  const handleGoToRoot = () => {
    window.location.href = "https://uyrenai.kz"
  };
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <div className="w-24 h-24 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-12 h-12 text-brand-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Subdomain Not Found
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              The subdomain you're looking for doesn't exist or is not
              configured properly.
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              What you can do:
            </h2>
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-brand-primary rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-muted-foreground">
                  Check the URL for any typos
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-brand-primary rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-muted-foreground">
                  Contact the site administrator if you believe this is an error
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-brand-primary rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-muted-foreground">
                  Try accessing the main domain instead
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleGoToRoot}
              className="bg-brand-primary hover:bg-brand-primary-hover text-white px-8 py-3 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 inline-flex items-center justify-center"
            >
              Go to Main Site
            </button>
            <button
              onClick={() => window.history.back()}
              className="border-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white px-8 py-3 text-lg font-semibold rounded-full transition-all duration-300 bg-transparent"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
