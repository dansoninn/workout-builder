import { PageBody } from "@/components/app/page";
import { ButtonLink } from "@/components/ui/button-link";

/** Shown for gyms that don't exist and gyms you are not a member of alike. */
export default function GymNotFound() {
  return (
    <PageBody className="grid max-w-md gap-3 pt-[12vh]">
      <h1 className="text-xl font-semibold">Gym not found</h1>
      <p className="text-muted-foreground">
        This gym doesn&apos;t exist, or you are not a member. If you were invited, open the invitation link you were sent.
      </p>
      <ButtonLink href="/" className="w-fit">
        Go to your gym
      </ButtonLink>
    </PageBody>
  );
}
