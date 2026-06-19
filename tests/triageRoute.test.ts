import request from "supertest";
import app from "../src/app";

describe("POST /triage - validation", () => {
  it("returns 400 when message field is missing", async () => {
    const res = await request(app).post("/triage").send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "message is required" });
  });

  it("returns 400 when body is empty", async () => {
    const res = await request(app)
      .post("/triage")
      .set("Content-Type", "application/json")
      .send("");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "message is required" });
  });

  it("returns 400 when message is null", async () => {
    const res = await request(app).post("/triage").send({ message: null });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "message must be a string" });
  });

  it("returns 400 when message is a number", async () => {
    const res = await request(app).post("/triage").send({ message: 42 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "message must be a string" });
  });

  it("returns 400 when message is empty string", async () => {
    const res = await request(app).post("/triage").send({ message: "" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "message must not be empty" });
  });

  it("returns 400 when message is whitespace only", async () => {
    const res = await request(app).post("/triage").send({ message: "   " });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "message must not be empty" });
  });

  it("returns 400 when message exceeds 5000 characters", async () => {
    const res = await request(app)
      .post("/triage")
      .send({ message: "x".repeat(5001) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "message is too long" });
  });

  it("returns 501 for a valid message (not yet implemented)", async () => {
    const res = await request(app)
      .post("/triage")
      .send({ message: "I need help with my account" });
    expect(res.status).toBe(501);
    expect(res.body).toEqual({ error: "not implemented" });
  });

  it("returns 501 for a message at exactly 5000 characters", async () => {
    const res = await request(app)
      .post("/triage")
      .send({ message: "a".repeat(5000) });
    expect(res.status).toBe(501);
    expect(res.body).toEqual({ error: "not implemented" });
  });
});

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
