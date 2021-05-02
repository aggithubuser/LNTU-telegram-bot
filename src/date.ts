import { setDay, format } from "date-fns";
import { uk } from "date-fns/locale";

export const studyWeek = () => {
  let now = new Date();
  let startDate = setDay(now, 2);
  let endDate = setDay(now, 6);
  let formatedStartDate = format(startDate, "PPPP", { locale: uk });
  let formatedEndDate = format(endDate, "PPPP", { locale: uk });
  const DATE = {
    year: now.getFullYear(),
    date: now.getDate(),
    month: now.getMonth() + 1,
  };
  let currentWeek = "";
  if (DATE.month == 1 || DATE.month == 2) {
    currentWeek = "Зимові канікули";
  } else if (DATE.month == 7 || DATE.month == 8) {
    currentWeek = "Літні канікули";
  } else {
    if (DATE.date % 2 == 0) {
      if (DATE.month == 7 || DATE.month == 1) {
        currentWeek = `Сьогодні вихідний!\nНаступний навчальний тиждень це, \n<b>Чисельник</b>\n<i>${formatedStartDate} - ${formatedEndDate}</i>`;
      } else {
        currentWeek = `<b>Чисельник</b>\n<i>${formatedStartDate} - ${formatedEndDate}</i>`;
      }
    } else if (DATE.date % 2 == 1) {
      if (DATE.month == 7 || DATE.month == 1) {
        currentWeek = `Сьогодні вихідний!\nНаступний навчальний тиждень це, \n<b>Знаменник</b>\n<i>${formatedStartDate} - ${formatedEndDate}</i>`;
      } else {
        currentWeek = `<b>Знаменник</b>\n<i>${formatedStartDate} - ${formatedEndDate}</i>`;
      }
    }
  }
  return currentWeek;
};
