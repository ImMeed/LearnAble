import { Brain } from "lucide-react";

export default function LandingPage() {
  return (
    <div>
      <header>
        <div>
          <Brain />
          <h1>LearnAble</h1>
        </div>
      </header>

      <main>
        <section style={{ textAlign: "center", padding: "100px 20px" }}>
  <h2 style={{ fontSize: "48px", fontWeight: "bold", lineHeight: "1.2" }}>
    Learn differently.<br />Succeed confidently.
  </h2>

  <p style={{
    marginTop: "20px",
    fontSize: "18px",
    maxWidth: "600px",
    marginInline: "auto"
  }}>
    An inclusive learning platform designed specifically for students with dyslexia and ADHD.
  </p>

  <div style={{ marginTop: "30px" }}>
    <button style={{ padding: "12px 24px", marginRight: "10px" }}>
      Sign In
    </button>

    <button style={{ padding: "12px 24px" }}>
      Get Started Free
    </button>
  </div>
</section>
<section style={{ padding: "60px 20px" }}>
  <h3 style={{ textAlign: "center", fontSize: "28px" }}>
    Key Features
  </h3>

  <div style={{
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "20px",
    marginTop: "40px"
  }}>
    <div>ADHD Tools</div>
    <div>Dyslexia Design</div>
    <div>AI Assistant</div>
    <div>Gamification</div>
    <div>Collaboration</div>
    <div>Mental Health</div>
  </div>
</section>
      </main>
    </div>
  );
}