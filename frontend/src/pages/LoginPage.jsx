import "../css/LoginPage.css";
import AuthForm from "../components/AuthForm";

export default function LoginPage(props) {
  return <AuthForm {...props} mode="login" />;
}