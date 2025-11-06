// ✅ Firebase config từ ảnh bạn gửi (đã xuất sẵn)
// Không sửa bất kỳ dòng nào bên dưới

const firebaseConfig = {
  apiKey: "AIzaSyDdKYH4y5a-DJD3-OgsSgCaJiW2m9_2gGQ",
  authDomain: "devvietgit-67392057-1106d.firebaseapp.com",
  projectId: "devvietgit-67392057-1106d",
  storageBucket: "devvietgit-67392057-1106d.appspot.com",
  messagingSenderId: "6822241594483",
  appId: "1:6822241594483:web:2aea7dde69f645750a0606"
};

// ✅ Khởi tạo Firebase
if (!firebase.apps || !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// ✅ Export cho các file khác sử dụng
const auth = firebase.auth();
const db = firebase.firestore();