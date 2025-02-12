"use client";
import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import dayjs from "dayjs";
import xlsx from "json-as-xlsx";
import { saveAs } from "file-saver";
import { Formik, Form, Field, FieldArray } from "formik";
import {
  FiCopy,
  FiCornerDownLeft,
  FiDownload,
  FiMinus,
  FiPlus,
  FiSearch,
  FiTable,
  FiUpload,
  FiX,
} from "react-icons/fi";
import { toast, ToastContainer } from "react-toastify";

const initialValues = {
  date: "",
  speakers: [{ name: "" }],
};

const SpeakerSchema = Yup.object().shape({
  date: Yup.date()
    .required("Data é obrigatória.")
    .test("is-sunday", "Por favor, selecione um domingo.", (value) => {
      const dayOfWeek = new Date(value).getUTCDay();
      return dayOfWeek === 0;
    }),
  speakers: Yup.array()
    .of(
      Yup.object().shape({
        name: Yup.string()
          .required("Nome é obrigatório.")
          .matches(/^[A-Za-zÀ-ÿ\s]+$/, "O nome deve conter apenas letras."),
      })
    )
    .min(1)
    .max(3),
});

export default function Home() {
  const filename = `oradores_${dayjs().format("YYYY-MM-DD").toString()}`;

  const [data, setData] = useState(initialValues);
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState([]);
  const [backup, setBackup] = useState([]);
  const [chosen, setChosen] = useState("");
  const [query, setQuery] = useState("");

  const capitalize = (name) => {
    return name
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  useEffect(() => {
    const storage = localStorage.getItem("oradores");
    if (storage) {
      const savedHistory = JSON.parse(storage);
      setHistory(savedHistory);
      setFilter(savedHistory);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("oradores", JSON.stringify(history));
    setFilter(history);
    setQuery("");
  }, [history]);

  const equalArrays = (arr1, arr2) => {
    if (arr1.length !== arr2.length) return false;
    const arr1Str = arr1.map((obj) => JSON.stringify(obj)).sort();
    const arr2Str = arr2.map((obj) => JSON.stringify(obj)).sort();
    return JSON.stringify(arr1Str) === JSON.stringify(arr2Str);
  };

  useEffect(() => {
    if (backup.length !== 0) {
      const fileChosen = document.getElementById("chosen");
      if (equalArrays(backup, history)) {
        toast("Registros iguais aos do arquivo.");
        fileChosen.textContent = chosen;
      } else {
        if (confirm(`Carregar registros do arquivo: "${chosen}"?`)) {
          const updatedHistory = [...history];
          let updatedItems = 0;
          let addedItems = 0;
          backup.forEach((newItem) => {
            const index = updatedHistory.findIndex(
              (item) => capitalize(item.name) === capitalize(newItem.name)
            );
            if (index !== -1) {
              if (
                new Date(newItem.date) > new Date(updatedHistory[index].date)
              ) {
                updatedHistory[index] = newItem;
                updatedItems++;
              }
            } else {
              updatedHistory.push(newItem);
              addedItems++;
            }
          });
          toast(
            `Registros: atualizou ${updatedItems} e adicionou ${addedItems} do arquivo carregado.`
          );
          setHistory(updatedHistory);
          fileChosen.textContent = chosen;
        }
      }
    }
  }, [backup]);

  const handleLoad = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = JSON.parse(e.target.result);
      setBackup(result);
    };
    reader.readAsText(file);
    setChosen(file.name);
  };

  const handleSubmit = async (values, { resetForm, setSubmitting }) => {
    const newNames = values.speakers
      .filter((x) => x.name)
      .map((x) => ({
        name: capitalize(x.name),
        date: values.date,
      }));
    const toastNames = [];
    setHistory((prevHistory) => {
      const updated = prevHistory.map((item) => {
        const updatedSpeaker = newNames.find(
          (x) => capitalize(x.name) === capitalize(item.name)
        );
        if (updatedSpeaker) {
          if (updatedSpeaker.date <= item.date) {
            toastNames.push(updatedSpeaker.name);
            updatedSpeaker.date = item.date;
          }
          return updatedSpeaker;
        }
        return item;
      });
      const newSpeakers = newNames.filter(
        (x) =>
          !prevHistory.some(
            (item) => capitalize(item.name) === capitalize(x.name)
          )
      );
      return [...updated, ...newSpeakers];
    });
    if (toastNames.length > 0) {
      toastNames.forEach((name) =>
        toast.warn(`Data deve ser posterior a última de ${name}.`)
      );
    }
    setSubmitting(false);
    onSearch(" ");
    resetForm();
  };

  const handleSave = () => {
    const blob = new Blob([JSON.stringify(history)], {
      type: "application/json",
    });
    saveAs(blob, `${filename}.json`);
  };

  const handleExport = () => {
    const data = [
      {
        sheet: "Oradores",
        columns: [
          { label: "Nome", value: "name" },
          { label: "Data", value: "date" },
        ],
        content: history,
      },
    ];
    const settings = {
      fileName: `${filename}`,
      extraLength: 3,
    };
    xlsx(data, settings);
  };

  const removeAccents = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const onSearch = (query) => {
    const search = removeAccents(query.toLowerCase()).split(" ");
    const filtered = history.filter((speaker) => {
      const name = removeAccents(speaker.name.toLowerCase());
      return search.every((part) => name.includes(part));
    });
    setFilter(filtered);
  };

  const handleSearch = (e) => {
    setQuery(e.target.value);
    onSearch(e.target.value);
  };

  const toggleSearch = (e) => {
    if (query.length !== 0) {
      setQuery("");
      setFilter(history);
    }
    e.target.closest("div").querySelector("input").focus();
  };

  const computeSundays = (date) => {
    const today = dayjs();
    const difference = today.diff(dayjs(date), "week");
    return difference;
  };

  const copyText = (e) => {
    const btn = e.target;
    const b = btn.closest("div").querySelector("b");
    const textToCopy = b.textContent;
    navigator.clipboard
      .writeText(textToCopy)
      .then(toast(`Nome copiado: ${textToCopy}.`));
  };

  const delSpeaker = (index) => {
    if (confirm("Excluir?")) {
      let nameToDel = "";
      const list = history.filter((speaker) => {
        let a = speaker.name,
          b = history[index].name;
        if (a === b) {
          nameToDel = a;
        }
        return a !== b;
      });
      toast.update(`Excluído da lista: ${nameToDel}.`);
      setHistory(list);
    }
  };

  return (
    <>
      <Formik
        initialValues={data}
        validationSchema={SpeakerSchema}
        onSubmit={handleSubmit}
      >
        {({ values, errors, touched, handleSubmit }) => (
          <Form
            className="w-screen max-w-5xl mx-auto space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
              if (errors.date && touched.date) {
                toast.error(errors.date);
              }
              if (errors.speakers) {
                errors.speakers.forEach((speaker, index) => {
                  if (speaker && touched.speakers && touched.speakers[index]) {
                    if (speaker.name) {
                      toast.error(`${index + 1}º Orador: ${speaker.name}`);
                    }
                  }
                });
              }
            }}
          >
            <h1 className="mt-4 text-center text-lg font-bold">
              Oradores da Reunião
            </h1>
            <div className="w-full flex flex-col md:flex-row items-center">
              <div className="w-full basis-128 flex justify-end items-center my-2">
                <input
                  id="loader"
                  type="file"
                  accept=".json"
                  onChange={handleLoad}
                  hidden
                />
                <label id="chosen" htmlFor="load-button">
                  Nenhum arquivo escolhido
                </label>
                <button
                  type="button"
                  id="load-button"
                  title="Carregar JSON"
                  onClick={() => document.getElementById("loader").click()}
                  className="mx-2 bg-teal-500 text-white p-3 rounded-md"
                >
                  <FiUpload />
                </button>
                <button
                  type="button"
                  title="Baixar JSON"
                  onClick={handleSave}
                  className="mx-2 bg-sky-500 text-white p-3 rounded-md"
                >
                  <FiDownload />
                </button>
              </div>
              <div className="w-full basis-128 flex justify-end items-center">
                <label htmlFor="export-button">Planilha:</label>
                <button
                  type="button"
                  id="export-button"
                  title="Exportar XLSX"
                  onClick={handleExport}
                  className="mx-2 bg-emerald-500 text-white p-3 rounded-md"
                >
                  <FiTable />
                </button>
                <label htmlFor="date-input">Data:</label>
                <Field name="date">
                  {({ field }) => (
                    <input
                      {...field}
                      type="date"
                      id="date-input"
                      placeholder="Data"
                      className={`mx-2 text-black py-1 border-4 rounded-md focus:border-gray-500 ${
                        touched.date && errors.date ? "border-red-500" : ""
                      }`}
                      max={new Date().toISOString().split("T")[0]}
                    />
                  )}
                </Field>
              </div>
            </div>
            <FieldArray name="speakers">
              {({ push, remove }) => (
                <>
                  {values.speakers.map((speaker, index) => (
                    <div key={index} className="flex items-center text-black">
                      <Field name={`speakers[${index}].name`}>
                        {({ field }) => (
                          <input
                            {...field}
                            type="text"
                            placeholder={`${index + 1}º Orador`}
                            id={`name${index + 1}`}
                            className={`mx-2 w-full p-1 border-4 rounded-md focus:border-yellow-500 ${
                              touched.speakers &&
                              touched.speakers[index] &&
                              errors.speakers &&
                              errors.speakers[index] &&
                              touched.speakers[index].name
                                ? "border-red-500"
                                : ""
                            }`}
                          />
                        )}
                      </Field>
                      {values.speakers.length > 1 && (
                        <button
                          type="button"
                          title="Remover entrada"
                          onClick={() => remove(index)}
                          className="mx-2 bg-yellow-500 text-white p-3 rounded-md"
                        >
                          <FiMinus />
                        </button>
                      )}
                    </div>
                  ))}
                  {values.speakers.length < 3 && (
                    <div className="w-full mx-auto text-right">
                      <button
                        type="button"
                        title="Adicionar entrada"
                        onClick={() => push({ name: "" })}
                        className="mx-2 bg-green-500 text-white p-3 rounded-md"
                      >
                        <FiPlus />
                      </button>
                    </div>
                  )}
                  <div className="w-full mx-auto text-right">
                    <label htmlFor="submit-button">Registrar oradores:</label>
                    <button
                      type="submit"
                      id="submit-button"
                      title="Registrar oradores"
                      className="mx-2 bg-gray-500 text-white p-3 rounded-md"
                    >
                      <FiCornerDownLeft />
                    </button>
                  </div>
                </>
              )}
            </FieldArray>
            <div className="mb-4 flex items-center text-white">
              <input
                type="text"
                value={query}
                onChange={handleSearch}
                placeholder="Pesquisar oradores..."
                name="search"
                className="mx-2 w-full p-1 text-black border-4 rounded-md focus:border-blue-500"
              />
              <button
                type="button"
                title="Pesquisar / Filtrar"
                onClick={toggleSearch}
                className={`mx-2 p-3 rounded-md ${
                  query.length === 0 ? "bg-blue-500" : "bg-rose-500"
                }`}
              >
                {query.length !== 0 ? <FiX /> : <FiSearch />}
              </button>
            </div>
            <div className="mx-2 text-left text-white dark:text-black">
              {filter.length === 0 ? (
                <div className="mx-2 text-center text-black dark:text-white">
                  <span>Vazio</span>
                </div>
              ) : (
                <ul className="mb-8">
                  {filter
                    .sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix())
                    .map((speaker, index) => (
                      <li
                        key={index}
                        className={
                          index % 2 === 0
                            ? "bg-slate-500 dark:bg-[#e3edf0]"
                            : "bg-stone-500 dark:bg-white"
                        }
                      >
                        <div className="py-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={copyText}
                            className="mx-2 p-0.5 bg-[#003b6f] text-white rounded-md"
                          >
                            <FiCopy />
                          </button>
                          <div className="basis-[50%] flex items-center break-words">
                            <b>{speaker.name}</b>
                          </div>
                          <div className="basis-[42%] flex flex-col md:flex-row justify-around items-center">
                            <span>
                              {dayjs(speaker.date).format("DD/MM/YYYY")}
                            </span>
                            <span className="border-2 rounded-full border-blue-500 w-fit px-2 font-bold">
                              {computeSundays(speaker.date)}&nbsp;domingos
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => delSpeaker(index)}
                            className="mx-2 bg-red-500 text-white rounded-full"
                          >
                            <FiX />
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </Form>
        )}
      </Formik>
      <ToastContainer />
    </>
  );
}
