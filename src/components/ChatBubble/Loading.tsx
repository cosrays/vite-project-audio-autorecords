import './Loading.less';

const Loading = () => (
  <span className={`chat-bubble-dot`}>
    <i className={`chat-bubble-dot-item`} key={`item-${1}`} />
    <i className={`chat-bubble-dot-item`} key={`item-${2}`} />
    <i className={`chat-bubble-dot-item`} key={`item-${3}`} />
  </span>
);

export default Loading;
