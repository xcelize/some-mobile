import {WebSocketCommandGateway} from './websocket-command-gateway';

describe('WebSocketCommandGateway', () => {
  let gateway: WebSocketCommandGateway;

  beforeEach(() => {
    gateway = new WebSocketCommandGateway(
      {} as never,
      {run: (callback: () => void) => callback()} as never
    );
  });

  it('routes a user message by subscription when Spring rewrites its destination', () => {
    let payload: string | undefined;
    gateway.observe('/user/queue/device-status').subscribe((message) => {
      payload = message;
    });

    handleFrame(
      'MESSAGE\n'
      + 'subscription:sub-/user/queue/device-status\n'
      + 'destination:/queue/device-status-user-session\n'
      + '\n'
      + '{"temperature":22}\0'
    );

    expect(payload).toBe('{"temperature":22}');
  });

  function handleFrame(frame: string): void {
    (gateway as unknown as {handleFrame(frame: string): void}).handleFrame(frame);
  }
});
