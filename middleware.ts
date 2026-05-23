import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isDashboardRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/programs(.*)",
  "/people(.*)",
  "/teams(.*)",
  "/events(.*)",
  "/notes(.*)",
  "/tasks(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isDashboardRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
